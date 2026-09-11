// Stable review IDs are shared with nodes.json and the review panel.
export const TIMING = Object.freeze({idleOpen:5000, shutterOpen:5000, idlePush:1000, push:1800, blur:950, cardEntry:850, expand:680, collapse:520, idleCarousel:5000, idleClose:3000, pullBack:1800, shutterClose:4500, autoCard:7000, contactReveal:2000, pane:520});
export const VOLUME = 0.38;
export const PROJECTS = [
 {id:'tmall',name:'天猫618',title:'天猫618项目',color:'#ffe773',desktop:'494:178',mobile:'494:193'},
 {id:'didi',name:'滴滴春日出行计划',title:'滴滴春日出行计划',color:'#f477e6',desktop:'494:45',mobile:'494:135'},
 {id:'coffee',name:'啡趣不可',title:'啡趣不可项目',color:'#88eaff',desktop:'494:47',mobile:'494:136'},
 {id:'halliday',name:'Halliday',title:'Halliday项目',color:'#88eaff',desktop:'494:55',mobile:'494:159'},
];
export function wrap(value,n=4){return ((value%n)+n)%n;}
export function signedDistance(index,position){return wrap(index-position+2)-2;}
export function canAutoSlide({state,hovering,dragging,lastAction},now){return state==='browse'&&!hovering&&!dragging&&now-lastAction>=TIMING.idleCarousel;}
