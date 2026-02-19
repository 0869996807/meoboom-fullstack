<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }

$host = getenv("DB_HOST");
$db   = getenv("DB_NAME");
$user = getenv("DB_USER");
$pass = getenv("DB_PASS");
$port = getenv("DB_PORT") ?: "5432";

if (!$host || !$db || !$user) { http_response_code(500); echo json_encode(["error"=>"Missing DB env vars"]); exit; }

$dsn = "pgsql:host=$host;port=$port;dbname=$db";
try {
  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["error"=>"DB connect failed", "detail"=>$e->getMessage()]);
  exit;
}

function body_json() {
  $raw = file_get_contents("php://input");
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}
?>