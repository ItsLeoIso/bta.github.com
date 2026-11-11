const KEY_ACTIONS = { KeyA:"left",KeyD:"right",KeyW:"jump",KeyS:"crouch",KeyH:"light",KeyJ:"medium",KeyK:"heavy",KeyL:"special",Escape:"pause" };
export class KeyboardInput {
  constructor(target=window) {
    this.target=target; this.down=new Set(); this.pressed=new Set();
    this.onKeyDown=this.onKeyDown.bind(this); this.onKeyUp=this.onKeyUp.bind(this); this.onBlur=this.clear.bind(this);
  }
  attach() { this.target.addEventListener("keydown",this.onKeyDown); this.target.addEventListener("keyup",this.onKeyUp); this.target.addEventListener("blur",this.onBlur); }
  detach() { this.target.removeEventListener("keydown",this.onKeyDown); this.target.removeEventListener("keyup",this.onKeyUp); this.target.removeEventListener("blur",this.onBlur); this.clear(); }
  onKeyDown(event) {
    if (Object.hasOwn(KEY_ACTIONS,event.code)) event.preventDefault();
    if (!this.down.has(event.code)) this.pressed.add(event.code);
    this.down.add(event.code);
  }
  onKeyUp(event) { this.down.delete(event.code); }
  clear() { this.down.clear(); this.pressed.clear(); }
  isDown(action) { return [...this.down].some(code=>KEY_ACTIONS[code]===action); }
  wasPressed(keyOrAction) { return [...this.pressed].some(code=>code===keyOrAction || KEY_ACTIONS[code]===keyOrAction); }
  getWorldAxis(axis) {
    if (axis!=="horizontal") return 0;
    return Number(this.isDown("right"))-Number(this.isDown("left"));
  }
  getAxis(axis,facing=1) {
    // Positive is forward, negative is backward, regardless of which side the fighter is on.
    return this.getWorldAxis(axis)*facing;
  }
  endFrame() { this.pressed.clear(); }
}
