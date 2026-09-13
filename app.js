import {TIMING,VOLUME,PROJECTS,wrap,signedDistance,canAutoSlide} from './config.js';
import {paneWidth,isReturnGesture} from './interaction.js';
const $=id=>document.getElementById(id);
const app=$('app'),camera=$('camera'),gallery=$('gallery'),carousel=$('carousel'),reader=$('reader'),scroll=$('reader-scroll'),audio=$('music');
const params=new URLSearchParams(location.search), forced=params.get('device');
let mobile=forced?forced==='mobile':matchMedia('(max-width:760px)').matches;
let state='loading',revision=0,stageTimer=0,lastAction=performance.now(),position=0,target=0,dragging=false,hovering=false,dragOrigin=0,dragPosition=0,dragDistance=0,dragEnded=0,current=null,hasRead=false,annotations=params.get('marks')==='1',muted=false,audioFade=0,manifest=null,carouselSettling=false,programmatic=false;
let lastFrame=performance.now(),stepCount=-1,activeShutter=null,loadError=false,manualHome=false,contactAnimation=null;
const scrollPositions={},cards=[],projectRects={};
try{muted=localStorage.getItem('derry-muted')==='true'}catch{}
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const duration=(ms)=>reduced?Math.min(ms,180):ms;
function announce(t){$('live-status').textContent=t}
function setState(next){state=next;app.dataset.state=state;app.classList.toggle('reading-layout',['reading','expanding','collapsing'].includes(state));syncReadingUI();syncSceneUI();clearTimeout(stageTimer);stageTimer=0;notify();drawMarkers()}
function delay(ms,token){return new Promise(resolve=>setTimeout(()=>resolve(token===revision),duration(ms)))}
function arm(ms,fn){clearTimeout(stageTimer);stageTimer=setTimeout(fn,ms)}
function touch(){lastAction=performance.now()}
function layout(){const vv=window.visualViewport;const vh=vv&&(!vv.scale||vv.scale===1)?vv.height:innerHeight;document.documentElement.style.setProperty('--viewport-height',vh+'px');document.body.classList.toggle('mobile',mobile);const w=mobile?402:1920,h=mobile?874:1150;document.documentElement.style.setProperty('--scene-scale',Math.max((app.clientWidth||innerWidth)/w,(app.clientHeight||innerHeight)/h));const viewWidth=app.clientWidth||innerWidth,viewHeight=app.clientHeight||innerHeight;const scale=Math.max(viewWidth/w,viewHeight/h);const boardLeft=(viewWidth-w*scale)/2+293.7*scale;app.style.setProperty('--mobile-actions-width',Math.max(140,Math.min(160,viewWidth*.45,boardLeft-36))+'px');renderCards();syncReadingUI();drawMarkers()}
function setShutter(closed=false){const kind=mobile?'mobile':'desktop';const clean=`assets/${kind}-${closed?'closed':'shutter'}-clean.png`;$('shutter-clean').src=clean;$('shutter-art').src=clean;$('shell-art').src=`assets/${kind}-${!mobile&&(closed||app.classList.contains('returned-shop'))?'closed':'shutter'}-clean.png`;$('stand-art').src='assets/stand-transparent.png';$('rest-art').src=clean;$('thanks-art').src=clean;$('thanks-art').hidden=true;}
function art(){const kind=mobile?'mobile':'desktop';$('open-art').src=`assets/${kind}-open-clean.png`;setShutter(['closing','closed'].includes(state));layout()}
function syncSceneUI(){
 $('home-actions').hidden=!(state==='open'&&manualHome);
 $('contact-actions').inert=state!=='closed';
 if(state!=='closing'){if(contactAnimation)contactAnimation.cancel();contactAnimation=null;}
}
function revealContacts(total){if(contactAnimation)contactAnimation.cancel();const wait=reduced?total*.45:TIMING.contactReveal;contactAnimation=$('contact-actions').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{delay:wait,duration:Math.max(1,total-wait),easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});}
function audioUI(){const playing=!audio.paused&&!muted&&audio.volume>0;$('music-button').querySelector('img').src=`assets/music-${playing?'on':'off'}.svg`;$('music-button').setAttribute('aria-label',playing?'关闭音乐':'开启音乐');$('music-button').setAttribute('aria-pressed',String(playing));drawMarkers()}
async function playMusic(reset=false){if(muted||document.hidden)return;cancelAnimationFrame(audioFade);audio.volume=VOLUME;if(reset)audio.currentTime=0;try{await audio.play()}catch{}audioUI()}
function stopMusic(){cancelAnimationFrame(audioFade);audio.pause();audio.currentTime=0;audio.volume=VOLUME;audioUI()}
function fadeMusic(ms){cancelAnimationFrame(audioFade);const start=performance.now(),vol=audio.volume;function tick(now){const p=Math.min(1,(now-start)/ms);audio.volume=vol*Math.pow(1-p,1.6);if(p<1)audioFade=requestAnimationFrame(tick);else stopMusic()}audioFade=requestAnimationFrame(tick)}
$('music-button').onclick=e=>{e.stopPropagation();touch();if(state==='closing'||state==='pullback')return;if(!audio.paused&&!muted){muted=true;audio.pause();}else{muted=false;playMusic(state==='closed')}try{localStorage.setItem('derry-muted',String(muted))}catch{}audioUI()};
audio.addEventListener('pause',audioUI);audio.addEventListener('play',audioUI);
function sceneClickable(on,text){$('scene-action').hidden=!on;$('scene-hint').textContent=text||'';$('scene-action').setAttribute('aria-label',text||'进入作品集')}
async function openShop(user=false){if(!['start','closed'].includes(state))return;const wasClosed=state==='closed';app.classList.remove('returned-shop');manualHome=false;const token=++revision;if(user)playMusic(true);setState('opening');sceneClickable(false);$('opening-sign').hidden=true;camera.classList.remove('zoomed','blurred');gallery.classList.remove('shown');gallery.inert=true;
 const shutter=$('shutter-panel');if(activeShutter)activeShutter.cancel();setShutter(wasClosed);shutter.style.transform='translateY(0)';const travel=mobile?336:650;
 activeShutter=shutter.animate([{transform:'translateY(0)'},{transform:`translateY(-${travel}px)`}],{duration:duration(TIMING.shutterOpen),easing:'cubic-bezier(.35,.05,.35,1)',fill:'forwards'});
 app.classList.add('opening-overlap');activeShutter.finished.catch(()=>{}).then(()=>app.classList.remove('opening-overlap'));
 if(!await delay(TIMING.shutterOpen*.88-(mobile?0:1000),token))return;setState('open');pushIn();
}
async function pushIn(){if(state!=='open')return;manualHome=false;const token=++revision;setState('pushing');sceneClickable(false);camera.style.transitionDuration=duration(TIMING.push)+'ms';camera.classList.add('zoomed');if(!await delay(TIMING.push,token))return;
 if(mobile){setState('blurring');camera.classList.add('blurred');if(!await delay(TIMING.blur,token))return}showGallery();}
function showGallery(){setState('browse');gallery.inert=false;gallery.setAttribute('aria-hidden','false');gallery.classList.add('shown');lastAction=performance.now();sceneClickable(false);announce('作品展示，包含四个项目，滑动选择或点击阅读');renderCards()}
async function closeShop(){if(state!=='open'||!manualHome)return;const alreadyHome=state==='open';const token=++revision;setState('pullback');gallery.classList.remove('shown');gallery.inert=true;gallery.setAttribute('aria-hidden','true');camera.classList.remove('blurred');sceneClickable(false);camera.style.transitionDuration=duration(TIMING.pullBack)+'ms';camera.classList.remove('zoomed');if(!alreadyHome&&!await delay(TIMING.pullBack,token))return;
 setState('closing');const shutter=$('shutter-panel');setShutter(true);await $('shutter-clean').decode().catch(()=>{});if(token!==revision)return;if(activeShutter)activeShutter.cancel();revealContacts(duration(TIMING.shutterClose));const travel=mobile?336:650;activeShutter=shutter.animate([{transform:`translateY(-${travel}px)`},{transform:'translateY(0)'}],{duration:duration(TIMING.shutterClose),easing:'cubic-bezier(.35,0,.35,1)',fill:'forwards'});fadeMusic(duration(TIMING.shutterClose));await activeShutter.finished.catch(()=>{});if(token!==revision)return;stopMusic();setState('closed');sceneClickable(true,'感谢观看 · 点击重新营业');announce('感谢观看，点击可以重新营业');}
$('scene-action').onclick=e=>{touch();if(state==='start'||state==='closed')openShop(true);else if(state==='open'&&!manualHome){playMusic();pushIn()}};
$('close-now').onclick=e=>{e.stopPropagation();touch();closeShop()};
$('resume-watching').onclick=e=>{e.stopPropagation();touch();pushIn()};
function buildCards(){PROJECTS.forEach((p,i)=>{const card=document.createElement('button');card.className='project-card';card.dataset.project=p.id;card.style.setProperty('--card-color',p.color);card.setAttribute('aria-label',`查看${p.name}作品`);card.innerHTML=`<img src="assets/${p.id}-cover.webp" alt="${p.name}作品封面"><span class="card-text"><strong>${p.title}</strong><span>welcome</span><span>欢迎观看</span></span>`;
 card.onclick=e=>{e.stopPropagation();if(performance.now()-dragEnded<180&&dragDistance>8)return;if(state==='browse'||state==='reading')openProject(i)};card.onfocus=()=>{touch()};cards.push(card);carousel.append(card);
 const dot=document.createElement('button');dot.setAttribute('aria-label',`居中显示${p.name}`);dot.onclick=e=>{e.stopPropagation();touch();target=position+signedDistance(i,position);carouselSettling=true;};$('project-dots').append(dot)});}
function renderCards(){const closest=wrap(Math.round(position));cards.forEach((card,i)=>{const d=signedDistance(i,position);const image=card.querySelector('img'),src=mobile?`assets/${PROJECTS[i].id}-mobile-card.webp`:`assets/${PROJECTS[i].id}-cover.webp`;if(image.getAttribute('src')!==src)image.setAttribute('src',src);let t;if(mobile){const stride=Math.min(112,innerWidth*.26),x=d*stride,y=Math.abs(d)**1.65*30,angle=d*16;t=`translate(-50%,-50%) translate(${x}px,${y}px) rotate(${angle}deg) scale(${1-Math.min(Math.abs(d),2)*.035})`;}else{const y=d*Math.min(innerHeight*.165,152),x=Math.abs(d)*10;t=`translate(-50%,-50%) translate(${x}px,${y}px) rotate(${d*-3}deg) scale(${1-Math.min(Math.abs(d),2)*.13})`;}card.style.transform=t;card.style.zIndex=String(Math.round(20-Math.abs(d)*5));card.style.visibility=Math.abs(d)>1.96?'hidden':'visible';card.style.opacity=String(Math.max(0,Math.min(1,(2-Math.abs(d))*7)));card.setAttribute('aria-pressed',String(current===i));});if(closest!==stepCount){stepCount=closest;$('project-count').textContent=`0${closest+1} / 04`;[...$('project-dots').children].forEach((dot,i)=>dot.setAttribute('aria-current',String(i===closest)));notify()}if(annotations)drawMarkers()}
function settle(){target=Math.round(position);carouselSettling=true;touch()}
carousel.addEventListener('pointerdown',e=>{if(!['browse','reading'].includes(state)||e.button!==0)return;dragging=true;dragOrigin=mobile?e.clientX:e.clientY;dragPosition=position;dragDistance=0;carouselSettling=false;touch();});
window.addEventListener('pointermove',e=>{if(!dragging)return;const delta=(mobile?e.clientX:e.clientY)-dragOrigin;dragDistance=Math.max(dragDistance,Math.abs(delta));position=dragPosition-delta/(mobile?150:180);renderCards();touch()});
window.addEventListener('pointerup',()=>{if(!dragging)return;dragging=false;dragEnded=performance.now();settle()});window.addEventListener('pointercancel',()=>{dragging=false;settle()});
carousel.addEventListener('mouseenter',()=>{if(!mobile){hovering=true;touch()}});carousel.addEventListener('mouseleave',()=>{hovering=false;touch()});
carousel.addEventListener('wheel',e=>{if(!['browse','reading'].includes(state))return;e.preventDefault();touch();position+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*.0025;settle()},{passive:false});
carousel.addEventListener('keydown',e=>{if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();target=Math.round(position)+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1);carouselSettling=true;touch()}});
function postState(){return {state,mobile,current:current===null?null:PROJECTS[current].id,project:PROJECTS[wrap(Math.round(position))].name}}
function notify(){if(parent!==window)parent.postMessage({type:'portfolio-state',...postState()},location.origin)}
function rectClone(card){const rect=card.getBoundingClientRect();const clone=document.createElement('div');clone.className='expanding-card';clone.innerHTML=`<img src="${card.querySelector('img').src}" alt="">`;Object.assign(clone.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(clone);return{clone,rect}}
async function openProject(index){if(!['browse','reading'].includes(state))return;if(state==='reading'&&current===index)return;const keepSplit=!mobile&&state==='reading';const retainedWidth=keepSplit?sidebarWidth:0;playMusic();touch();hasRead=true;const previous=current;if(previous!==null)scrollPositions[PROJECTS[previous].id]=scroll.scrollTop;current=index;const {clone,rect}=rectClone(cards[index]);const token=++revision;setState('expanding');gallery.classList.add('selected-project');carouselSettling=false;const p=PROJECTS[index];setPane(retainedWidth);projectRects[p.id]=rect;reader.hidden=false;reader.style.opacity='0';$('reader-title').textContent=p.name;$('project-content').replaceChildren();
 if(!manifest){$('project-content').innerHTML='<p class="load-message">作品正在准备，请稍候。</p>';try{manifest=await fetch('projects.json').then(r=>{if(!r.ok)throw Error();return r.json()})}catch{$('project-content').innerHTML='<p class="load-message">作品暂时无法加载，请返回后重试。</p>';}}
 if(manifest){const frag=document.createDocumentFragment();manifest[p.id].forEach((item,i)=>{const im=document.createElement('img');im.src=item.src;im.width=item.width;im.height=item.height;im.loading=i<2?'eager':'lazy';im.decoding='async';im.alt=`${p.name}作品，第${i+1}段`;im.dataset.reviewId=`${mobile?'M':'D'}-P${index+1}-S${String(i+1).padStart(2,'0')}`;frag.append(im)});$('project-content').replaceChildren(frag)}
 if(token!==revision){clone.remove();return}scroll.scrollTop=scrollPositions[p.id]||0;if(keepSplit){clone.remove();reader.style.opacity='1';setState('reading');updateScrollbar();renderCards();announce(`正在阅读${p.name}`);return}const dest=reader.getBoundingClientRect();const anim=clone.animate([{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:'20px',opacity:1},{left:dest.left+'px',top:'0px',width:dest.width+'px',height:dest.height+'px',borderRadius:'0px',opacity:1}],{duration:duration(TIMING.expand),easing:'cubic-bezier(.22,.8,.22,1)',fill:'forwards'});await anim.finished.catch(()=>{});reader.style.opacity='1';clone.animate([{opacity:1},{opacity:0}],{duration:duration(180),fill:'forwards'}).finished.then(()=>clone.remove());if(token!==revision)return;setState('reading');syncReadingUI();$('back-button').focus({preventScroll:true});updateScrollbar();announce(`正在阅读${p.name}，使用返回按钮退出`);renderCards();}
async function back(){if(state!=='reading')return;cancelAnimationFrame(paneFrame);paneDrag=null;app.classList.remove('resizing');const token=++revision;const i=current,p=PROJECTS[i];scrollPositions[p.id]=scroll.scrollTop;setState('collapsing');gallery.inert=false;app.classList.remove('reading-layout');const dest=cards[i].getBoundingClientRect(),origin=reader.getBoundingClientRect();const clone=document.createElement('div');clone.className='expanding-card';clone.innerHTML=`<img src="assets/${p.id}-cover.webp" alt="">`;Object.assign(clone.style,{left:origin.left+'px',top:'0px',width:origin.width+'px',height:origin.height+'px'});document.body.append(clone);reader.hidden=true;await clone.animate([{left:origin.left+'px',top:'0px',width:origin.width+'px',height:origin.height+'px',borderRadius:'0px',opacity:.95},{left:dest.left+'px',top:dest.top+'px',width:dest.width+'px',height:dest.height+'px',borderRadius:'20px',opacity:0}],{duration:duration(TIMING.collapse),easing:'cubic-bezier(.22,.75,.18,1)',fill:'forwards'}).finished.catch(()=>{});clone.remove();if(token!==revision)return;current=null;gallery.classList.remove('selected-project');gallery.inert=false;setState('browse');touch();cards[i].focus({preventScroll:true});renderCards();announce('已返回作品卡片');}
$('back-button').onclick=e=>{e.stopPropagation();back()};
async function returnToShop(){
 if(state==='reading')await back();
 if(state!=='browse')return;
 const token=++revision;touch();dragging=false;hovering=false;carouselSettling=false;
 if(!mobile){app.classList.add('returned-shop');$('shell-art').src='assets/desktop-closed-clean.png';}
 setState('pullback');gallery.inert=true;gallery.classList.remove('shown');gallery.setAttribute('aria-hidden','true');
 camera.classList.remove('blurred');sceneClickable(false);camera.style.transitionDuration=duration(TIMING.pullBack)+'ms';camera.classList.remove('zoomed');
 if(!await delay(TIMING.pullBack,token))return;
 manualHome=true;setState('open');touch();sceneClickable(true,'');$('scene-action').focus({preventScroll:true});announce('已返回店铺主页面，点击继续浏览作品');
}
$('gallery-back').onclick=e=>{e.stopPropagation();returnToShop()};

function updateScrollbar(){const max=scroll.scrollHeight-scroll.clientHeight,ratio=max>0?scroll.scrollTop/max:0,h=$('scroll-track').clientHeight,thumb=Math.max(22,h*scroll.clientHeight/Math.max(scroll.scrollHeight,1));$('scroll-thumb').style.height=thumb+'px';$('scroll-thumb').style.transform=`translateY(${ratio*Math.max(0,h-thumb)}px)`;$('scroll-control').setAttribute('aria-valuenow',String(Math.round(ratio*100)));drawMarkers()}
scroll.addEventListener('scroll',()=>{touch();updateScrollbar()},{passive:true});
let scrollDragging=false;function scrub(e){const rect=$('scroll-track').getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));scroll.scrollTop=ratio*(scroll.scrollHeight-scroll.clientHeight);touch()}
$('scroll-control').onpointerdown=e=>{scrollDragging=true;e.currentTarget.setPointerCapture(e.pointerId);scrub(e)};$('scroll-control').onpointermove=e=>{if(scrollDragging)scrub(e)};$('scroll-control').onpointerup=()=>{scrollDragging=false};$('scroll-control').onkeydown=e=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();scroll.scrollTop=e.key==='Home'?0:e.key==='End'?scroll.scrollHeight:scroll.scrollTop+(e.key.includes('Down')?1:-1)*(e.key.startsWith('Page')?scroll.clientHeight*.8:80)}};
window.addEventListener('keydown',e=>{touch();if(e.key==='Escape'&&!modalOpen())previousPage()});
window.addEventListener('pointerdown',e=>{touch();if(e.target.closest('#music-button'))return;if(['open','browse','reading'].includes(state)&&audio.paused&&!muted)playMusic()});
window.addEventListener('pointermove',()=>{if(['browse','open'].includes(state))touch()},{passive:true});
window.addEventListener('resize',()=>{if(!forced){const next=matchMedia('(max-width:760px)').matches;if(next!==mobile){mobile=next;art();camera.classList.toggle('blurred',mobile&&['browse','reading','expanding'].includes(state));}}layout();updateScrollbar()});
if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>{layout();updateScrollbar()});
window.addEventListener('wheel',()=>{if(state==='open'&&manualHome)touch()},{passive:true});
let resumeAfterVisibility=false;
function pauseForVisibility(){if(!audio.paused&&!muted)resumeAfterVisibility=true;audio.pause();audioUI();}
function restoreVisibility(){touch();lastFrame=performance.now();if(document.hidden)return;const resume=resumeAfterVisibility;resumeAfterVisibility=false;if(resume&&!muted&&!['closing','closed','pullback'].includes(state))playMusic();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForVisibility();else restoreVisibility()});
window.addEventListener('pagehide',pauseForVisibility);window.addEventListener('pageshow',restoreVisibility);
function loop(now){const dt=Math.min(50,now-lastFrame);lastFrame=now;if(!document.hidden&&!modalOpen()){if(carouselSettling&&!dragging&&['browse','reading'].includes(state)){position+=(target-position)*(1-Math.exp(-dt/110));if(Math.abs(target-position)<.001){position=target;carouselSettling=false}renderCards();}else if(!reduced&&canAutoSlide({state,hovering,dragging,lastAction},now)){position+=dt/TIMING.autoCard;renderCards();}if(state==='open'&&manualHome&&now-lastAction>=TIMING.idleClose)closeShop();}requestAnimationFrame(loop)}
function stageId(){const p=mobile?'M':'D';if(['start','opening'].includes(state))return p+'-01';if(state==='open')return p+'-02';if(['pushing','pullback'].includes(state))return p+'-03';if(['closing','closed'].includes(state))return p+(mobile?'-05':'-04');if(mobile&&['blurring','browse'].includes(state))return 'M-04';return p+'-03'}
const stateNames={loading:'载入素材',start:'待营业',opening:'卷帘门上升',open:'店铺全景',pushing:'镜头推进',blurring:'背景模糊',browse:'作品卡片',expanding:'展开作品',reading:'作品阅读',collapsing:'返回卡片',pullback:'退回全景',closing:'关门 · 音乐淡出',closed:'感谢观看'};
function modalOpen(){return $('qr-dialog').open}
function showQR(){if(state!=='closed')return;touch();clearTimeout(stageTimer);$('qr-dialog').showModal();$('qr-close').focus();}
$('qr-button').onclick=e=>{e.stopPropagation();showQR()};$('qr-close').onclick=()=>$('qr-dialog').close();$('qr-dialog').addEventListener('close',()=>{touch();if(state==='start')arm(TIMING.idleOpen,()=>openShop(false));else if(state==='open'&&!manualHome)arm(TIMING.idlePush,pushIn);$('qr-button').focus({preventScroll:true})});
function drawMarkers(){const layer=$('node-layer');layer.replaceChildren();if(!annotations)return;const scene=document.createElement('span');scene.className='node-tag scene-tag';scene.textContent=`${stageId()} · ${stateNames[state]}`;layer.append(scene);function mark(el,id,name){if(!el||el.hidden)return;const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)return;const tag=document.createElement('span');tag.className='node-tag';tag.textContent=`${id} · ${name}`;tag.style.left=Math.max(6,Math.min(innerWidth-145,r.left))+'px';tag.style.top=Math.max(6,Math.min(innerHeight-25,r.top))+'px';layer.append(tag)}
 if(state==='browse'||(!mobile&&state==='reading'))mark($('gallery-back'),mobile?'M-UI-05':'D-UI-05','返回主页面');mark($('qr-button'),'UI-04','如何找到我？');if(!mobile&&state==='reading')mark($('reader-handle'),'D-UI-07','拉伸作品栏');mark($('music-button'),'UI-02',audio.paused?'音乐关':'音乐开');if(['browse','reading','expanding','collapsing'].includes(state)&&(!mobile||reader.hidden)){cards.forEach((c,i)=>mark(c,`${mobile?'M':'D'}-P${i+1}`,PROJECTS[i].name));}if(!reader.hidden){mark($('back-button'),'UI-01','返回');mark($('scroll-control'),'UI-03','滑动条');mark($('reader-title'),`${mobile?'M':'D'}-R${current+1}`,'作品正文');for(const im of $('project-content').querySelectorAll('img')){const r=im.getBoundingClientRect();if(r.bottom>95&&r.top<innerHeight-30)mark(im,im.dataset.reviewId,'正文段落');}}}
async function jump(to){cancelAnimationFrame(paneFrame);app.classList.remove('returned-shop');manualHome=false;revision++;clearTimeout(stageTimer);if(activeShutter)activeShutter.cancel();document.querySelectorAll('.expanding-card').forEach(e=>e.remove());reader.hidden=true;current=null;setPane(0);gallery.inert=true;gallery.classList.remove('shown','selected-project');camera.classList.remove('zoomed','blurred');$('opening-sign').hidden=true;stopMusic();hasRead=false;const shutter=$('shutter-panel');shutter.style.transform='translateY(0)';setShutter(false);if(to==='start'){setState('start');$('opening-sign').hidden=false;sceneClickable(true,'点击任意位置，即刻营业');arm(TIMING.idleOpen,()=>openShop(false))}else if(to==='open'||to==='push'){shutter.style.transform=`translateY(-${mobile?336:650}px)`;setState('open');sceneClickable(true,'点击继续探索');if(to==='push')pushIn();else arm(TIMING.idlePush,pushIn)}else if(to==='home'){if(!mobile){app.classList.add('returned-shop');$('shell-art').src='assets/desktop-closed-clean.png';}shutter.style.transform=`translateY(-${mobile?336:650}px)`;manualHome=true;setState('open');touch();sceneClickable(true,'')}else if(to==='closed'){setShutter(true);setState('closed');sceneClickable(true,'感谢观看 · 点击重新营业')}else{shutter.style.transform=`translateY(-${mobile?336:650}px)`;camera.style.transitionDuration='0ms';camera.classList.add('zoomed');if(mobile)camera.classList.add('blurred');if(to.startsWith('card-')){position=Number(to.slice(-1))-1;target=position;carouselSettling=false;}showGallery();if(to.startsWith('project-'))openProject(Number(to.slice(-1))-1)}}
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='set-marks'){annotations=!!e.data.value;drawMarkers()}if(e.data?.type==='jump')jump(e.data.stage)});

let paneFrame=0,sidebarWidth=0,paneDrag=null,suppressHandleClick=false,lastTap=null,tapStart=null;
function syncReadingUI(){
 const reading=['reading','expanding'].includes(state);
 $('gallery-back').setAttribute('aria-label','返回店铺主页面');
 sidebarWidth=mobile?0:paneWidth(sidebarWidth,innerWidth);
 app.style.setProperty('--sidebar-width',sidebarWidth+'px');
 app.classList.toggle('sidebar-open',!mobile&&sidebarWidth>0);
 if(reading)gallery.inert=mobile||sidebarWidth===0;
 $('back-button').hidden=!reading||(!mobile&&sidebarWidth>0);
 $('reader-handle').hidden=mobile||state!=='reading';
 $('reader-handle').setAttribute('aria-expanded',String(sidebarWidth>0));$('handle-art').src='assets/sidebar-toggle.png';
 $('reader-handle').setAttribute('aria-label',sidebarWidth>0?'收起作品卡片栏，回到全屏阅读；也可左右拖动':'展开作品卡片栏；也可左右拖动');
}
function setPane(width,settle=false){const ratio=scroll.scrollTop/Math.max(1,scroll.scrollHeight);sidebarWidth=paneWidth(width,innerWidth,settle);syncReadingUI();renderCards();scroll.scrollTop=ratio*scroll.scrollHeight;updateScrollbar()}
function animatePane(width){cancelAnimationFrame(paneFrame);const start=performance.now(),from=sidebarWidth,to=paneWidth(width,innerWidth,true);function frame(now){const p=Math.min(1,(now-start)/duration(TIMING.pane)),ease=1-Math.pow(1-p,4);setPane(from+(to-from)*ease);if(p<1)paneFrame=requestAnimationFrame(frame);else{paneFrame=0;setPane(to,true)}}paneFrame=requestAnimationFrame(frame);}

$('reader-handle').onpointerdown=e=>{
 if(e.button!==0||mobile||state!=='reading')return;
 e.stopPropagation();touch();cancelAnimationFrame(paneFrame);paneDrag={id:e.pointerId,x:e.clientX,width:sidebarWidth,moved:false};
 e.currentTarget.setPointerCapture(e.pointerId);app.classList.add('resizing');
};
$('reader-handle').onpointermove=e=>{
 if(!paneDrag||e.pointerId!==paneDrag.id)return;
 const dx=e.clientX-paneDrag.x;if(Math.abs(dx)>5)paneDrag.moved=true;
 if(paneDrag.moved)setPane(paneDrag.width+dx);
};
function endPane(e){if(!paneDrag||e.pointerId!==paneDrag.id)return;suppressHandleClick=paneDrag.moved;paneDrag=null;app.classList.remove('resizing');animatePane(sidebarWidth);touch();}
$('reader-handle').onpointerup=endPane;$('reader-handle').onpointercancel=e=>{endPane(e);suppressHandleClick=false};
$('reader-handle').onclick=e=>{e.stopPropagation();if(suppressHandleClick){suppressHandleClick=false;return}animatePane(sidebarWidth?0:Math.min(innerWidth*.42,520));touch()};
$('reader-handle').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();animatePane(e.key==='Home'?0:e.key==='End'?innerWidth:sidebarWidth+(e.key==='ArrowRight'?40:-40));touch()}};
function previousPage(){if(state==='reading')return back();if(state==='browse')return returnToShop()}
function canReturnAt(target){return ['browse','reading'].includes(state)&&!modalOpen()&&!target.closest('button,a,input,select,textarea,[role="scrollbar"],dialog')}
async function init(){buildCards();art();audioUI();const closingPreload=document.createElement('img');closingPreload.src=`assets/${mobile?'mobile':'desktop'}-closed-clean.png`;closingPreload.decode().catch(()=>{});manifest=await fetch('projects.json').then(r=>r.json()).catch(()=>null);const initial=[$('rest-art'),$('open-art'),$('shutter-art'),$('shell-art'),$('stand-art'),$('shutter-clean'),...(mobile?[$('closeup-art'),$('blur-art')]:[$('desktop-closeup-art')])];await Promise.all(initial.map(im=>im.decode().catch(()=>{loadError=true})));if(loadError){$('loading').innerHTML='<p>画面未能加载，请刷新页面重试。</p>';return}$('loading').style.opacity='0';setTimeout(()=>$('loading').remove(),350);await jump(params.get('stage')||'start');requestAnimationFrame(loop)}
init();
