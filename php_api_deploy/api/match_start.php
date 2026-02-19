<?php
require_once __DIR__ . "/config.php";
$in = body_json();
$room = strtoupper(trim($in["room_code"] ?? ""));
$mode = trim($in["mode"] ?? "classic");
$players = $in["players"] ?? [];
if ($room === "" || !is_array($players) || count($players) < 2) { http_response_code(400); echo json_encode(["error"=>"bad input"]); exit; }

$pdo->beginTransaction();
$stmt = $pdo->prepare("INSERT INTO matches(room_code, mode, started_at) VALUES(:r,:m, NOW()) RETURNING id");
$stmt->execute([":r"=>$room, ":m"=>$mode]);
$match_id = $stmt->fetchColumn();

$insP = $pdo->prepare("INSERT INTO match_players(match_id, player_token, display_name) VALUES(:mid,:t,:n)");
$upP  = $pdo->prepare("INSERT INTO players(player_token, display_name) VALUES(:t,:n)
  ON CONFLICT(player_token) DO UPDATE SET display_name=EXCLUDED.display_name");

foreach ($players as $p) {
  $t = trim($p["player_token"] ?? "");
  $n = trim($p["display_name"] ?? "");
  if ($t==="" || $n==="") continue;
  $upP->execute([":t"=>$t, ":n"=>$n]);
  $insP->execute([":mid"=>$match_id, ":t"=>$t, ":n"=>$n]);
}
$pdo->commit();
echo json_encode(["match_id"=>$match_id]);
