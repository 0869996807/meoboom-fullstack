<?php
require_once __DIR__ . "/config.php";
$limit = intval($_GET["limit"] ?? 30);
if ($limit<=0) $limit=30;
if ($limit>100) $limit=100;

$stmt = $pdo->prepare("SELECT room_code, mode, players_count,
  EXTRACT(EPOCH FROM (NOW() - updated_at))::int AS updated_ago
  FROM rooms
  WHERE status='open' AND players_count < 10 AND updated_at > (NOW() - INTERVAL '120 seconds')
  ORDER BY updated_at DESC
  LIMIT :lim");
$stmt->bindValue(":lim", $limit, PDO::PARAM_INT);
$stmt->execute();
$items = $stmt->fetchAll();
echo json_encode([\"items\"=>$items]);
