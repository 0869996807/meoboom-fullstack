<?php
require_once __DIR__ . "/config.php";
$tok = trim($_GET["player_token"] ?? "");
$limit = intval($_GET["limit"] ?? 30);
if ($limit<=0) $limit=30;
if ($limit>200) $limit=200;
if ($tok==="") { http_response_code(400); echo json_encode(["error"=>"missing player_token"]); exit; }

$stmt = $pdo->prepare("SELECT m.room_code, m.mode, to_char(m.ended_at,'YYYY-MM-DD HH24:MI') as ended_at,
  mp.placement, mp.exploded, mp.delta
  FROM match_players mp
  JOIN matches m ON m.id = mp.match_id
  WHERE mp.player_token=:t AND m.ended_at IS NOT NULL
  ORDER BY m.ended_at DESC
  LIMIT :lim");
$stmt->bindValue(":t", $tok);
$stmt->bindValue(":lim", $limit, PDO::PARAM_INT);
$stmt->execute();
$items = $stmt->fetchAll();
echo json_encode(["items"=>$items]);
