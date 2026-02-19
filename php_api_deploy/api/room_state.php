<?php
require_once __DIR__ . "/utils.php";
$roomId = trim($_GET["room_id"] ?? "");
if ($roomId==="") fail("Missing room_id", 400);

$room = q($pdo, "SELECT id,name,status,max_players,created_at,updated_at FROM rooms WHERE id=:id", [":id"=>$roomId])->fetch();
if (!$room) fail("Room not found", 404);

$players = q($pdo, "SELECT id,name,connected,last_seen_at FROM players WHERE room_id=:r ORDER BY created_at ASC", [":r"=>$roomId])->fetchAll();
$events  = q($pdo, "SELECT id,created_at,type,actor_name,message FROM events WHERE room_id=:r ORDER BY id DESC LIMIT 30", [":r"=>$roomId])->fetchAll();

ok(["room"=>$room,"players"=>$players,"events"=>$events]);
