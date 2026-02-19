<?php
require_once __DIR__ . "/utils.php";
$roomId = trim($_GET["room_id"] ?? "");
if ($roomId === "") {
  $rows = q($pdo, "SELECT id,room_id,started_at,ended_at,winner_name,loser_name
                   FROM matches ORDER BY started_at DESC LIMIT 50")->fetchAll();
  ok(["matches"=>$rows]);
}
$rows = q($pdo, "SELECT id,room_id,started_at,ended_at,winner_name,loser_name
                 FROM matches WHERE room_id=:r ORDER BY started_at DESC LIMIT 50", [":r"=>$roomId])->fetchAll();
ok(["matches"=>$rows]);
