<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

function db() {
  static $pdo = null;
  if ($pdo) return $pdo;

  $dsn = "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4";
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
  ]);

  return $pdo;
}

function json_out($data){
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function read_json(){
  return json_decode(file_get_contents("php://input"), true) ?? [];
}