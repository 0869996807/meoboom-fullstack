<?php
require_once __DIR__ . "/config.php";
$limit = intval($_GET["limit"] ?? 50);
if ($limit<=0) $limit=50;
if ($limit>200) $limit=200;

$stmt = $pdo->prepare("SELECT display_name, rating, wins, losses, games FROM players
  WHERE games > 0
  ORDER BY rating DESC, wins DESC, games DESC
  LIMIT :lim");
$stmt->bindValue(":lim", $limit, PDO::PARAM_INT);
$stmt->execute();
$items = $stmt->fetchAll();
echo json_encode(["items"=>$items]);
