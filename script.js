const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Paleta clássica Nokia 3310
const COLOR_BG = '#9bbc0f';
const COLOR_DARK = '#0f380f';
const COLOR_MID = '#306230';

// Sistema de Áudio Retrô (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function playSound(type) {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        osc.frequency.setValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// Estado do Jogo
let gameState = 'START'; // START, PLAYING, GAMEOVER, VICTORY
let score = 0;
let frameCount = 0;

// Controles
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
    if (e.code === 'Enter' && gameState !== 'PLAYING') {
        startGame();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Jogador
const player = {
    x: 24,
    y: 96,
    width: 24,
    height: 14,
    speed: 1,
    lives: 3,
    shootCooldown: 0,
    invulnerable: 0
};

// Listas de Entidades
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let boss = null;

function startGame() {
    gameState = 'PLAYING';
    score = 0;
    frameCount = 0;
    player.x = 24;
    player.y = 96;
    player.lives = 3;
    player.invulnerable = 0;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    boss = null;
}

// Desenho em Pixel Art
function drawPixelMatrix(matrix, startX, startY, pixelSize = 2, color = COLOR_DARK) {
    ctx.fillStyle = color;
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] === 1) {
                ctx.fillRect(
                    Math.round(startX + c * pixelSize),
                    Math.round(startY + r * pixelSize),
                    pixelSize,
                    pixelSize
                );
            }
        }
    }
}

const SPRITE_PLAYER = [
    [1,1,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,0,0,0,0,0],
    [1,1,1,1,0,0,0,0,0,0,0,0],
    [1,1,0,0,0,0,0,0,0,0,0,0]
];

const SPRITE_ENEMY_1 = [
    [0,0,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,0],
    [1,1,0,1,1,0,1,1],
    [1,1,1,1,1,1,1,1],
    [0,1,0,1,1,0,1,0],
    [1,0,0,0,0,0,0,1]
];

const SPRITE_ENEMY_2 = [
    [0,0,0,1,1,1,1,0],
    [0,1,1,1,1,1,1,1],
    [1,1,0,0,1,1,1,1],
    [0,1,1,1,1,1,1,1],
    [0,0,0,1,1,1,1,0]
];

const SPRITE_HEART = [
    [0,1,0,1,0],
    [1,1,1,1,1],
    [1,1,1,1,1],
    [0,1,1,1,0],
    [0,0,1,0,0]
];

const SPRITE_BOSS = [
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,0,0,1,1,1,1,0,0,1,1,1,0],
    [1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1],
    [1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1],
    [0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0],
    [0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0]
];

function createExplosion(x, y) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 18
        });
    }
}

function checkCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

// Atualização da Lógica
function update() {
    if (gameState !== 'PLAYING') return;
    frameCount++;

    // Movimento do Jogador
    if ((keys['ArrowUp'] || keys['KeyW']) && player.y > 24) player.y -= player.speed;
    if ((keys['ArrowDown'] || keys['KeyS']) && player.y < canvas.height - player.height - 4) player.y += player.speed;
    if ((keys['ArrowLeft'] || keys['KeyA']) && player.x > 4) player.x -= player.speed;
    if ((keys['ArrowRight'] || keys['KeyD']) && player.x < canvas.width - player.width - 4) player.x += player.speed;

    if (player.shootCooldown > 0) player.shootCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;

    // Disparo do Jogador
    if (keys['Space'] && player.shootCooldown === 0) {
        bullets.push({
            x: player.x + player.width,
            y: player.y + 6,
            width: 8,
            height: 2,
            speed: 6
        });
        player.shootCooldown = 14;
        playSound('shoot');
    }

    // Atualizar tiros do jogador
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].x += bullets[i].speed;
        if (bullets[i].x > canvas.width) bullets.splice(i, 1);
    }

    // Spawn do Chefão aos 300 pontos
    if (score >= 300 && !boss) {
        enemies = [];
        boss = {
            x: canvas.width - 56,
            y: 60,
            width: 48,
            height: 30,
            hp: 30,
            maxHp: 30,
            vy: 1.5,
            shootTimer: 0
        };
    }

    // Spawn de Inimigos normais (antes do chefão)
    if (!boss && frameCount % 55 === 0) {
        const type = Math.random() > 0.4 ? 1 : 2;
        enemies.push({
            x: canvas.width,
            y: 26 + Math.random() * (canvas.height - 46),
            width: 16,
            height: type === 1 ? 12 : 1.6,
            speed: type === 1 ? 2 : 1.6,
            type: type,
            startY: 0,
            angle: Math.random() * Math.PI * 2
        });
    }

    // Atualizar Inimigos
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.x -= e.speed;
        if (e.type === 1) {
            e.angle += 0.08;
            e.y += Math.sin(e.angle) * 1.2;
        }

        // Colisão tiro x inimigo
        let destroyed = false;
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[j], e)) {
                bullets.splice(j, 1);
                createExplosion(e.x + e.width / 2, e.y + e.height / 2);
                playSound('explosion');
                score += e.type === 1 ? 20 : 30;
                enemies.splice(i, 1);
                destroyed = true;
                break;
            }
        }
        if (destroyed) continue;

        // Colisão inimigo x jogador
        if (player.invulnerable === 0 && checkCollision(player, e)) {
            enemies.splice(i, 1);
            damagePlayer();
            continue;
        }

        if (e.x + e.width < 0) enemies.splice(i, 1);
    }

    // Atualizar Chefão
    if (boss) {
        boss.y += boss.vy;
        if (boss.y <= 26 || boss.y + boss.height >= canvas.height - 4) {
            boss.vy *= -1;
        }

        boss.shootTimer++;
        if (boss.shootTimer % 45 === 0) {
            enemyBullets.push({
                x: boss.x,
                y: boss.y + boss.height / 2,
                width: 6,
                height: 4,
                vx: -3.5,
                vy: (player.y - boss.y) * 0.015
            });
        }

        // Tiros no Chefão
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (checkCollision(bullets[j], boss)) {
                bullets.splice(j, 1);
                boss.hp--;
                playSound('hit');
                if (boss.hp <= 0) {
                    createExplosion(boss.x + 24, boss.y + 15);
                    playSound('win');
                    score += 500;
                    boss = null;
                    gameState = 'VICTORY';
                    break;
                }
            }
        }

        if (boss && player.invulnerable === 0 && checkCollision(player, boss)) {
            damagePlayer();
        }
    }

    // Atualizar tiros inimigos
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eb = enemyBullets[i];
        eb.x += eb.vx;
        eb.y += eb.vy;

        if (player.invulnerable === 0 && checkCollision(player, eb)) {
            enemyBullets.splice(i, 1);
            damagePlayer();
            continue;
        }

        if (eb.x < 0 || eb.y < 20 || eb.y > canvas.height) {
            enemyBullets.splice(i, 1);
        }
    }

    // Atualizar partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        particles[i].life--;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

function damagePlayer() {
    player.lives--;
    player.invulnerable = 70;
    createExplosion(player.x + 12, player.y + 7);
    playSound('explosion');
    if (player.lives <= 0) {
        gameState = 'GAMEOVER';
    }
}

// Renderização na Tela LCD
function drawHUD() {
    ctx.fillStyle = COLOR_DARK;
    ctx.fillRect(0, 19, canvas.width, 2);

    // Corações (Vidas)
    for (let i = 0; i < player.lives; i++) {
        drawPixelMatrix(SPRITE_HEART, 8 + i * 14, 5, 2, COLOR_DARK);
    }

    // Barra de vida do Boss se ativo
    if (boss) {
        ctx.fillStyle = COLOR_DARK;
        ctx.font = 'bold 11px Courier New';
        ctx.fillText('BOSS', 110, 13);
        ctx.strokeStyle = COLOR_DARK;
        ctx.strokeRect(145, 5, 62, 9);
        const barWidth = Math.max(0, (boss.hp / boss.maxHp) * 58);
        ctx.fillRect(147, 7, barWidth, 5);
    }

    // Pontuação formatada (ex: 00120)
    ctx.fillStyle = COLOR_DARK;
    ctx.font = 'bold 14px Courier New';
    const scoreText = String(score).padStart(5, '0');
    ctx.fillText(scoreText, canvas.width - 52, 14);
}

function draw() {
    // Limpar tela LCD
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') {
        ctx.fillStyle = COLOR_DARK;
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px Courier New';
        ctx.fillText('SPACE IMPACT', canvas.width / 2, 68);

        drawPixelMatrix(SPRITE_PLAYER, canvas.width / 2 - 12, 85, 2);

        ctx.font = 'bold 12px Courier New';
        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillText('PRESSIONE ENTER PARA JOGAR', canvas.width / 2, 135);
        }
        ctx.font = '10px Courier New';
        ctx.fillText('NOKIA 3310 EDITION', canvas.width / 2, 175);
        ctx.textAlign = 'left';
        return;
    }

    drawHUD();

    // Desenhar Jogador (pisca se estiver invulnerável)
    if (player.invulnerable === 0 || Math.floor(player.invulnerable / 5) % 2 === 0) {
        drawPixelMatrix(SPRITE_PLAYER, player.x, player.y, 2);
    }

    // Desenhar Tiros
    ctx.fillStyle = COLOR_DARK;
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
    enemyBullets.forEach(eb => ctx.fillRect(eb.x, eb.y, eb.width, eb.height));

    // Desenhar Inimigos
    enemies.forEach(e => {
        const sprite = e.type === 1 ? SPRITE_ENEMY_1 : SPRITE_ENEMY_2;
        drawPixelMatrix(sprite, e.x, e.y, 2);
    });

    // Desenhar Boss
    if (boss) {
        drawPixelMatrix(SPRITE_BOSS, boss.x, boss.y, 3);
    }

    // Desenhar Explosões
    ctx.fillStyle = COLOR_DARK;
    particles.forEach(p => ctx.fillRect(p.x, p.y, 3, 3));

    // Telas de Fim de Jogo ou Vitória
    if (gameState === 'GAMEOVER' || gameState === 'VICTORY') {
        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(48, 52, canvas.width - 96, 88);
        ctx.strokeStyle = COLOR_DARK;
        ctx.lineWidth = 2;
        ctx.strokeRect(48, 52, canvas.width - 96, 88);

        ctx.fillStyle = COLOR_DARK;
        ctx.textAlign = 'center';
        ctx.font = 'bold 18px Courier New';
        ctx.fillText(
            gameState === 'VICTORY' ? 'MISSAO CUMPRIDA!' : 'GAME OVER',
            canvas.width / 2,
            78
        );

        ctx.font = 'bold 12px Courier New';
        ctx.fillText(`PONTOS: ${score}`, canvas.width / 2, 100);

        ctx.font = '11px Courier New';
        ctx.fillText('ENTER PARA REINICIAR', canvas.width / 2, 124);
        ctx.textAlign = 'left';
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();