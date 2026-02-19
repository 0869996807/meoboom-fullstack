<?php
require_once __DIR__ . "/utils.php";
$data = body_json();
$roomId = need($data, "room_id");
$playerName = need($data, "player_name");

$room = q($pdo, "SELECT id,name,status,max_players FROM rooms WHERE id=:id", [":id"=>$roomId])->fetch();
if (!$room) fail("Room not found", 404);
if ($room["status"] === "closed") fail("Room closed", 410);

$cnt = (int)q($pdo, "SELECT COUNT(*) c FROM players WHERE room_id=:r", [":r"=>$roomId])->fetch()["c"];
if ($cnt >= (int)$room["max_players"]) {
  $exists = q($pdo, "SELECT id FROM players WHERE room_id=:r AND name=:n", [":r"=>$roomId,":n"=>$playerName])->fetch();
  if (!$exists) fail("Room full", 409);
}

$player = q($pdo, "SELECT id FROM players WHERE room_id=:r AND name=:n", [":r"=>$roomId,":n"=>$playerName])->fetch();
if ($player) {
  q($pdo, "UPDATE players SET connected=true, last_seen_at=now() WHERE id=:id", [":id"=>$player["id"]]);
  q($pdo, "UPDATE rooms SET updated_at=now() WHERE id=:id", [":id"=>$roomId]);
  ok(["player"=>["id"=>$player["id"],"name"=>$playerName],"rejoin"=>true]);
} else {
  $pid = uid("p_");
  try {
    q($pdo, "INSERT INTO players(id,room_id,name,connected) VALUES(:id,:r,:n,true)",
      [":id"=>$pid,":r"=>$roomId,":n"=>$playerName]);
  } catch (Exception $e) {
    fail("Name already taken in room", 409);
  }
  log_event($pdo, $roomId, "join", $playerName, $playerName." vào phòng");
  q($pdo, "UPDATE rooms SET updated_at=now() WHERE id=:id", [":id"=>$roomId]);
  ok(["player"=>["id"=>$pid,"name"=>$playerName],"rejoin"=>false]);
}
