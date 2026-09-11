export function paneWidth(value,viewport,settle=false){const max=Math.min(600,viewport*.48);const n=Math.max(0,Math.min(value,max));return settle?(n<160?0:Math.max(Math.min(240,max),n)):n}
export function isReturnGesture(previous,next){return !!previous&&previous.state===next.state&&previous.pointer===next.pointer&&next.t>previous.t&&next.t-previous.t<=320&&Math.hypot(next.x-previous.x,next.y-previous.y)<=24}
export function previewScale(width,height){return Math.max(.1,Math.min(1,width/389,height/826))}
