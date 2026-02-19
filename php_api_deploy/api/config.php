<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET,POST,OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$DATABASE_URL = getenv("DATABASE_URL");
if (!$DATABASE_URL) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"DATABASE_URL missing"]);
  exit;
}

$db = parse_url($DATABASE_URL);
$host = $db["host"] ?? "";
$port = $db["port"] ?? 5432;
$user = $db["user"] ?? "";
$pass = $db["pass"] ?? "";
$name = ltrim($db["path"] ?? "", "/");

try {
  $pdo = new PDO(
    "pgsql:host={$host};port={$port};dbname={$name};sslmode=require",
    $user,
    $pass,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]
  );
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"DB connect error","detail"=>$e->getMessage()]);
  exit;
}

function body_json() {
  $raw = file_get_contents("php://input");
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}
function q($pdo, $sql, $params=[]) {
  $st = $pdo->prepare($sql);
  $st->execute($params);
  return $st;
}
function uid($prefix="") { return $prefix . bin2hex(random_bytes(8)); }
