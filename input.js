export class Input {
  constructor({ canvas, onRotate }) {
    this.canvas = canvas;
    this.onRotate = onRotate;
    this.enabled = true;

    this._keyDown = this._keyDown.bind(this);
    this._pointerDown = this._pointerDown.bind(this);
    this._contextMenu = (e) => e.preventDefault();
  }

  attach() {
    window.addEventListener("keydown", this._keyDown, { passive: false });
    window.addEventListener("pointerdown", this._pointerDown, { passive: true });
    window.addEventListener("contextmenu", this._contextMenu);
  }

  detach() {
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("pointerdown", this._pointerDown);
    window.removeEventListener("contextmenu", this._contextMenu);
  }

  _keyDown(e) {
    if (!this.enabled) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.onRotate?.(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.onRotate?.(1);
    }
  }

  _pointerDown(e) {
    if (!this.enabled) return;
    // tap left/right half of the screen
    const x = e.clientX;
    const w = window.innerWidth || 1;
    if (x < w / 2) this.onRotate?.(-1);
    else this.onRotate?.(1);
  }
}

