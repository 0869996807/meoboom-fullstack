<?php
require_once __DIR__ . "/config.php";
$in = body_json();
$tok = trim($in["player_token"] ?? "");
$name = trim($in["display_name"] ?? "");
if ($tok === "" || $name === "") { http_response_code(400); echo json_encode(["error"=>"missing"]); exit; }

$stmt = $pdo->prepare("INSERT INTO players(player_token, display_name) VALUES(:t,:n)
  ON CONFLICT(player_token) DO UPDATE SET display_name=EXCLUDED.display_name");
$stmt->execute([":t"=>$tok, ":n"=>$name]);
echo json_encode(["ok"=>true]);
