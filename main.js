import { Game } from "./game/game.js";

const canvas = document.getElementById("game");
const overlay = document.getElementById("overlay");
const btnStart = document.getElementById("btnStart");
const btnRestart = document.getElementById("btnRestart");
const highScoreEl = document.getElementById("highScore");
const finalScoreRow = document.getElementById("finalScoreRow");
const finalScoreEl = document.getElementById("finalScore");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const speedEl = document.getElementById("speed");

const HS_KEY = "hexstacks_highscore_v1";
const getHighScore = () => Number(localStorage.getItem(HS_KEY) || "0");
const setHighScore = (v) => localStorage.setItem(HS_KEY, String(v));

highScoreEl.textContent = String(getHighScore());

const game = new Game({
  canvas,
  onHud: ({ score, combo, speedMult }) => {
    scoreEl.textContent = String(score);
    comboEl.textContent = `${combo}×`;
    speedEl.textContent = `${speedMult.toFixed(2)}×`;
  },
  onGameOver: ({ score }) => {
    const hs = getHighScore();
    if (score > hs) setHighScore(score);
    highScoreEl.textContent = String(getHighScore());
    finalScoreRow.hidden = false;
    finalScoreEl.textContent = String(score);
    overlay.hidden = false;
    btnStart.hidden = true;
    btnRestart.hidden = false;
  },
});

function start() {
  overlay.hidden = true;
  btnStart.hidden = true;
  btnRestart.hidden = true;
  finalScoreRow.hidden = true;
  game.start();
}

btnStart.addEventListener("click", start);
btnRestart.addEventListener("click", start);

// Keep overlay visible until user starts
overlay.hidden = false;
btnStart.hidden = false;
btnRestart.hidden = true;
