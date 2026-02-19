<?php
require_once __DIR__ . "/utils.php";
$data = body_json();
$roomName = need($data, "room_name");
$maxPlayers = isset($data["max_players"]) ? (int)$data["max_players"] : 10;
if ($maxPlayers <= 1 || $maxPlayers > 10) $maxPlayers = 10;

$roomId = uid("room_");
try {
  q($pdo, "INSERT INTO rooms(id,name,status,max_players) VALUES(:id,:name,'open',:m)",
    [":id"=>$roomId, ":name"=>$roomName, ":m"=>$maxPlayers]);
  log_event($pdo, $roomId, "create", null, "Tạo phòng: ".$roomName);
} catch (Exception $e) {
  fail("Room name already exists", 409);
}
ok(["room"=>["id"=>$roomId,"name"=>$roomName,"max_players"=>$maxPlayers]]);
