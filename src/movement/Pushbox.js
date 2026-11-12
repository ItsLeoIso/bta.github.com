/** Placeholder body-space collision. Separate from attack hitboxes and hurtboxes. */
export const DEFAULT_PUSHBOX = Object.freeze({halfWidth:55,standingHeight:70,crouchingHeight:50});
export function getPushbox(fighter, dimensions=DEFAULT_PUSHBOX) {
  return {left:fighter.x-dimensions.halfWidth,right:fighter.x+dimensions.halfWidth,
    top:fighter.y-(fighter.crouching?dimensions.crouchingHeight:dimensions.standingHeight),bottom:fighter.y};
}
function overlapsVertically(a,b){return a.bottom>b.top&&b.bottom>a.top;}
export function resolvePushboxes(first,second,{minX,maxX},dimensions=DEFAULT_PUSHBOX) {
  const a=getPushbox(first,dimensions),b=getPushbox(second,dimensions);
  if(!overlapsVertically(a,b))return false;
  const overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left);
  if(overlap<=0)return false;
  let left=first,right=second;
  if(first.x>second.x){left=second;right=first;}
  else if(first.x===second.x){
    const fp=first.previousX??first.x,sp=second.previousX??second.x;
    if(fp>sp){left=second;right=first;}
  }
  const leftCapacity=Math.max(0,left.x-minX),rightCapacity=Math.max(0,maxX-right.x);
  let moveLeft=Math.min(overlap/2,leftCapacity),moveRight=Math.min(overlap/2,rightCapacity);
  let remainder=overlap-moveLeft-moveRight;
  if(remainder>0){const extra=Math.min(remainder,leftCapacity-moveLeft);moveLeft+=extra;remainder-=extra;}
  if(remainder>0){const extra=Math.min(remainder,rightCapacity-moveRight);moveRight+=extra;}
  left.x-=moveLeft;right.x+=moveRight;
  return true;
}
