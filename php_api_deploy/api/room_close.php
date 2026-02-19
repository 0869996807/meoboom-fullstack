<?php
require_once __DIR__ . "/utils.php";
$data = body_json();
$roomId = need($data, "room_id");

$room = q($pdo, "SELECT id FROM rooms WHERE id=:id", [":id"=>$roomId])->fetch();
if (!$room) fail("Room not found", 404);

q($pdo, "UPDATE rooms SET status='closed', updated_at=now() WHERE id=:id", [":id"=>$roomId]);
log_event($pdo, $roomId, "close", null, "Đóng phòng");
ok(["room_id"=>$roomId,"status"=>"closed"]);
