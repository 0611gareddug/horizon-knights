// 프롤로그: 수습 기사 시험 → 천공석 붕괴 → 탈출 → 비행선 → 제1장
const near = (p, m, r) => Math.hypot(p.x - m.x, p.y - m.y) < r;

export async function runPrologue(G) {
  const P = G.player;
  const touch = G.input.isTouch;
  const K = {
    move: touch ? '왼쪽 화면을 끌어서' : 'WASD로',
    attack: touch ? '공격 버튼으로' : '좌클릭으로',
    roll: touch ? '구르기 버튼으로' : 'Space로',
    skill: touch ? '스킬 버튼(첫 번째)으로' : 'Q로',
  };

  // ---------- 0. 오프닝 ----------
  G.loadZone('training');
  P.view.visible = false;
  await G.cut(async (d) => {
    await d.fade(true, 0.01);
    await d.narrate(
      [
        '끝없는 구름 바다 위로 섬들이 떠 있는 세계, 에테르 하늘.',
        '모든 섬은 하늘 한가운데의 거대한 수정, 천공석의 힘으로 떠 있다.',
        '그리고 오늘은… 하늘 기사단의 수습 시험 날이다.',
      ],
      { keepBlack: true },
    );
    await d.hideNarration();
    await d.fade(false, 0.8);
  });

  // ---------- 1. 시험 시작 ----------
  const T = G.terrain.marks;
  const kaira = G.addNpc('kaira', T.kaira.x, T.kaira.y);
  G.combat.spawnDummies(T.dummies);
  P.view.visible = true;
  P.fx = 0;
  P.fy = -1;
  await G.cut(async (d) => {
    await d.camTo(T.kaira.x, T.kaira.y + 2, 1.2);
    await d.say('kaira', '{name}! 늦지 않고 왔군. 좋아, 근성 있는 녀석이야!');
    await d.say('kaira', '나는 오늘 시험 감독관 카이라다. 이 시험을 통과하면 너도 정식 하늘 기사가 된다.');
    await d.say('player', '잘 부탁드립니다, 교관님!');
    await d.say('kaira', '좋은 대답이다! 그럼 시작한다. 먼저 허수아비 앞으로 와라!');
    d.camFollow();
  });

  await G.objective(`${K.move} 허수아비 앞까지 이동하기`, () => near(P, T.walkTo, 1.6));
  await G.cut(async (d) => {
    kaira.faceTo(P);
    await d.say('kaira', '좋아. 이제 허수아비를 쳐봐라! 망설이지 말고!');
  });

  G.combat.stats.dummyHits = 0;
  await G.objective(`${K.attack} 허수아비를 5번 공격하기`, () => G.combat.stats.dummyHits >= 5, () => `${Math.min(5, G.combat.stats.dummyHits)}/5`);
  await G.cut(async (d) => {
    await d.say('kaira', '나쁘지 않군! 다음은 구르기다. 구르는 순간에는 어떤 공격도 맞지 않는다!');
  });

  G.stats.rolls = 0;
  await G.objective(`${K.roll} 구르기 2번 하기`, () => G.stats.rolls >= 2, () => `${Math.min(2, G.stats.rolls)}/2`);
  await G.cut(async (d) => {
    await d.say('kaira', '좋다! 기사라면 자기만의 기술이 있어야지. 스킬을 써봐라!');
  });

  G.stats.skills = 0;
  await G.objective(`${K.skill} 스킬 쓰기`, () => G.stats.skills >= 1);
  await G.cut(async (d) => {
    await d.say('kaira', '훌륭해! 마지막 시험이다. 슬라임 세 마리를 처치해라. 근성!!');
  });

  G.combat.stats.kills = 0;
  G.combat.respawn = false;
  for (const [x, y] of [
    [7.5, 12.5],
    [16.5, 12.5],
    [12, 4.8],
  ])
    G.combat.spawnSlimeAt(x, y, false);
  await G.objective('슬라임 3마리 처치하기', () => G.combat.stats.kills >= 3, () => `${Math.min(3, G.combat.stats.kills)}/3`);

  // ---------- 2. 천공석 붕괴 ----------
  await G.cut(async (d) => {
    kaira.faceTo(P);
    await d.say('kaira', '해냈군! 이제 기사단장님께 보고만 하면, 너는 정식…');
    G.sfx.boom();
    d.flash(0.9);
    d.shake(9);
    d.pillar(12, -1);
    await d.wait(0.5);
    kaira.face(0, -1);
    P.fx = 0;
    P.fy = -1;
    await d.camTo(12, 1, 1.0);
    await d.say('kaira', '뭐, 뭐야?! 저 빛은… 천공석이 있는 쪽이잖아!');
    await d.say('narrator', '하늘 한가운데에서 거대한 빛기둥이 솟았다. 천공석이 산산조각 난 것이다.');
    G.sfx.rumble();
    d.shake(7);
    G.crumbleRows(0, 1);
    await d.wait(0.6);
    d.camFollow();
    kaira.faceTo(P);
    await d.say('kaira', '섬이 가라앉는다! {name}, 남쪽 끝까지 달려라! 뒤돌아보지 마!');
    await d.say('kaira', '나도 곧 따라간다! 근성!!');
  });

  // ---------- 3. 탈출 ----------
  kaira.walkTo(T.kaira.x - 6, T.kaira.y - 2, 5).then(() => G.removeNpc(kaira));
  G.combat.clear();
  G.startEscape();
  await G.objective('무너지는 섬에서 남쪽 끝까지 달려 뛰어내리기!', () => P.y > T.edgeY - 1.2 && P.z < -1.2);
  G.stopEscape();

  // ---------- 4. 비행선 ----------
  await G.cut(async (d) => {
    await d.fade(true, 0.5, '#cfe9ff');
    G.loadZone('deck');
    G.sky.wind = 7;
    const D = G.terrain.marks;
    const bartol = G.addNpc('bartol', D.bartol.x, D.bartol.y);
    const elian = G.addNpc('elian', D.elian.x, D.elian.y);
    bartol.face(0, -1);
    elian.face(1, 1);
    P.view.visible = false;
    await d.wait(0.6);
    await d.fade(false, 0.5, '#cfe9ff');
    await d.wait(0.4);
    // 쿵! (갑판에 처박힘)
    P.view.visible = true;
    P.x = P.px = D.land.x;
    P.y = P.py = D.land.y;
    P.z = P.pz = 0;
    P.fx = 0;
    P.fy = 1;
    P.knockedT = 1.6;
    G.sfx.boom();
    d.shake(8);
    G.fx.burst(P.x, P.y, 0, { count: 18, speed: 3, up: 2, color: 0xcf9d66, size: 2 });
    d.emote(P, '쿵!', 0xffffff);
    G.cam.x = G.camTargetFor(P).x;
    G.cam.y = G.camTargetFor(P).y;
    await d.wait(1.0);
    bartol.faceTo(P);
    elian.faceTo(P);
    await d.say('bartol', '으하하! 하늘에서 사람이 떨어지는 건 오랜만이군! 괜찮나, 꼬맹이?');
    await d.say('elian', '선장님… 저희가 받아낸 게 아니라, 그냥 떨어진 자리에 배가 있었던 거예요.');
    await d.say('bartol', '결과가 좋으면 다 좋은 거다! 나는 바르톨, 이 비행선의 선장이지.');
    await d.say('elian', '저는 엘리안이에요. 마법 부여를 연구하는 학자죠. 반가워요, {name} 씨.');
    G.sfx.boom();
    d.shake(10);
    d.emote(bartol, '쾅!', 0xffe08a);
    await d.wait(0.5);
    await d.say('bartol', '하하! 걱정 마라, 이번엔 안 부딪혔…');
    await d.say('elian', '부딪혔어요.');
    // 카이라가 뱃머리로 기어 올라옴
    const kaira2 = G.addNpc('kaira', 8.5, 2.5);
    G.fx.burst(8.5, 2.5, 0, { count: 10, speed: 2, color: 0xcf9d66 });
    await kaira2.walkTo(D.kaira.x, D.kaira.y, 3);
    kaira2.faceTo(P);
    await d.say('kaira', '허억… 허억… 밧줄에 매달려서… 따라왔다… 근성으로!');
    await d.say('player', '교관님! 무사하셨군요!');
    elian.faceTo(P);
    await d.say('elian', '천공석이 부서지면서 파편 아홉 개가 여러 섬으로 흩어졌어요.');
    await d.say('elian', '파편을 전부 모으면… 천공석을 다시 복원할 수 있을 거예요.');
    elian.face(0, -1);
    d.emote(elian, '……', 0xd8c4ff);
    await d.wait(0.9);
    elian.faceTo(P);
    await d.say('bartol', '좋아! 첫 번째 파편은 저 아래 초원 섬에 떨어졌다. 출발이다!');
    await d.say('kaira', '{name}, 시험은 아직 안 끝났다. 이건 진짜 임무다. 근성!');
    await d.fade(true, 0.8);
  });

  // ---------- 5. 제1장 ----------
  G.save.prologueDone = true;
  G.saveGame();
  P.knockedT = 0;
  G.sky.wind = 1;
  G.enterChapter1();
}
