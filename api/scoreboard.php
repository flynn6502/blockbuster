<?php
declare(strict_types=1);

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function respond(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function db_path(): string
{
    return __DIR__ . DIRECTORY_SEPARATOR . "scoreboard.db";
}

function db_connect(): PDO
{
    $path = db_path();
    $pdo = new PDO("sqlite:" . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $pdo;
}

function init_schema(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL CHECK(score >= 0),
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    );
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC, id ASC)");
}

function migrate_legacy_db_if_needed(): void
{
    $legacyPath = dirname(dirname(__DIR__)) . DIRECTORY_SEPARATOR . "private" . DIRECTORY_SEPARATOR . "blockbuster" . DIRECTORY_SEPARATOR . "scoreboard.db";
    $newPath = db_path();
    if (is_file($legacyPath) && !is_file($newPath)) {
        @rename($legacyPath, $newPath);
    }
}

function normalize_name(string $name): string
{
    $lettersOnly = strtoupper(preg_replace('/[^A-Z]/', '', $name) ?? '');
    if ($lettersOnly === '') {
        return "AAA";
    }
    return substr($lettersOnly . "AAA", 0, 3);
}

function read_payload(): array
{
    $raw = file_get_contents("php://input");
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function get_leaderboard(PDO $pdo, int $limit = 8): array
{
    $stmt = $pdo->prepare(
        "SELECT name, score
         FROM scores
         ORDER BY score DESC, id ASC
         LIMIT :limit"
    );
    $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
    $stmt->execute();
    return array_map(
        static function (array $row): array {
            return [
                "name" => normalize_name((string)$row["name"]),
                "score" => max(0, (int)$row["score"]),
            ];
        },
        $stmt->fetchAll()
    );
}

function get_best_score(PDO $pdo): int
{
    $result = $pdo->query("SELECT MAX(score) AS best_score FROM scores")->fetch();
    if (!$result || $result["best_score"] === null) {
        return 0;
    }
    return max(0, (int)$result["best_score"]);
}

try {
    migrate_legacy_db_if_needed();
    $pdo = db_connect();
    init_schema($pdo);

    $method = $_SERVER["REQUEST_METHOD"] ?? "GET";

    if ($method === "GET") {
        respond([
            "leaderboard" => get_leaderboard($pdo, 8),
            "bestScore" => get_best_score($pdo),
        ]);
    }

    if ($method === "POST") {
        $payload = read_payload();
        $name = normalize_name((string)($payload["name"] ?? "AAA"));
        $score = max(0, (int)($payload["score"] ?? 0));

        $stmt = $pdo->prepare("INSERT INTO scores(name, score) VALUES(:name, :score)");
        $stmt->bindValue(":name", $name, PDO::PARAM_STR);
        $stmt->bindValue(":score", $score, PDO::PARAM_INT);
        $stmt->execute();

        respond([
            "ok" => true,
            "leaderboard" => get_leaderboard($pdo, 8),
            "bestScore" => get_best_score($pdo),
        ], 201);
    }

    respond(["error" => "Method not allowed"], 405);
} catch (Throwable $e) {
    respond([
        "error" => "Scoreboard backend error",
        "details" => $e->getMessage(),
    ], 500);
}
