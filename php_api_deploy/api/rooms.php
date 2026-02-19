<?php
require_once __DIR__.'/utils.php';

$pdo = db();

if($_SERVER['REQUEST_METHOD'] === 'GET'){
  $rows = $pdo->query("SELECT * FROM rooms ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
  json_out($rows);
}

if($_SERVER['REQUEST_METHOD'] === 'POST'){
  $data = read_json();

  $name = $data['name'] ?? 'Room';

  $stmt = $pdo->prepare("INSERT INTO rooms(name) VALUES(?)");
  $stmt->execute([$name]);

  json_out(["ok"=>true]);
}