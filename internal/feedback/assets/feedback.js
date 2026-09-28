/* prevly preview feedback widget */
"use strict";(()=>{var Dt="/_prevly/api/feedback";function Te(e={}){let t=e.path??Dt,n=e.fetchImpl??((...r)=>fetch(...r));return{async list(){try{let r=await n(t,{method:"GET",headers:{accept:"application/json"},credentials:"same-origin"});if(!r.ok)return[];let i=await r.json();return Array.isArray(i?.items)?i.items:[]}catch{return[]}},async submit(r,i){let o=new FormData;o.append("meta",new Blob([JSON.stringify(r)],{type:"application/json"}),"meta.json"),i&&o.append("screenshot",i,"screenshot.png");let s;try{s=await n(t,{method:"POST",body:o,credentials:"same-origin"})}catch(a){return{ok:!1,kind:"error",message:$t(a)}}if(s.status===429)return{ok:!1,kind:"rate-limit",retryAfter:Ft(s.headers?.get("retry-after")??null),message:"Too many reports from this preview. Try again in a moment."};if(s.status===201||s.status===200){try{let a=await s.json();if(a?.item)return{ok:!0,item:a.item}}catch{}return{ok:!1,kind:"error",message:"The server returned an unexpected answer."}}return{ok:!1,kind:"error",message:await Ot(s)}}}}function Ft(e){if(!e)return null;let t=Number.parseInt(e,10);if(Number.isFinite(t)&&t>=0)return t;let n=Date.parse(e);return Number.isFinite(n)?Math.max(0,Math.round((n-Date.now())/1e3)):null}async function Ot(e){try{let t=await e.json(),n=typeof t?.error=="string"?t.error:t?.message;if(typeof n=="string"&&n)return`${e.status} \xB7 ${n}`}catch{}return`Sending failed (HTTP ${e.status}).`}function $t(e){return e instanceof Error&&e.message?e.message:"Network error."}function v(e,t={},...n){let r=document.createElement(e);if(t.class&&(r.className=t.class),t.text!==void 0&&(r.textContent=t.text),t.html!==void 0&&(r.innerHTML=t.html),t.style&&Object.assign(r.style,t.style),t.attrs)for(let[i,o]of Object.entries(t.attrs))r.setAttribute(i,o);if(t.on)for(let[i,o]of Object.entries(t.on))r.addEventListener(i,o);for(let i of n)i==null||i===!1||r.append(i);return r}var de='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">',Pe=`${de}<path d="M20.5 11.7a8.2 8.2 0 0 1-8.8 8.2 8.8 8.8 0 0 1-3.3-.8L3.5 20.5l1.4-4.6a8.2 8.2 0 0 1-1.4-4.6 8.2 8.2 0 0 1 8.2-8.2 8.2 8.2 0 0 1 8.8 8.6z"/><circle cx="12" cy="11.8" r="1.35" fill="currentColor" stroke="none"/></svg>`,re=`${de}<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`,Re=`${de}<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4"/></svg>`;function V(e,t){let n=document.createElement("span");return n.className=t,n.innerHTML=e,n}function Ae(){try{return typeof HTMLElement<"u"&&typeof HTMLElement.prototype.togglePopover=="function"}catch{return!1}}function U(e,t){t?(e.setAttribute("popover","manual"),e.classList.add("top-layer")):e.setAttribute("hidden","");let n=!1,r=()=>{if(!n){if(n=!0,!t){e.removeAttribute("hidden");return}try{e.showPopover()}catch{e.removeAttribute("hidden")}}},i=()=>{if(n){if(n=!1,!t){e.setAttribute("hidden","");return}try{e.hidePopover()}catch{e.setAttribute("hidden","")}}};return{node:e,show:r,hide:i,isShown:()=>n,destroy(){i(),e.remove()}}}var Ne=4;function Le(e,t){let n=v("span",{class:"badge-count",attrs:{hidden:""}}),r=v("button",{class:"badge-button",attrs:{type:"button","aria-label":t.labels.badge,"data-prevly":"badge"}},V(Pe,"badge-icon"),n),i=v("button",{class:"badge-close",attrs:{type:"button","aria-label":t.labels.close,"data-prevly":"badge-close"},on:{click:y=>{y.stopPropagation(),t.onClose()}}},V(re,"badge-close-icon")),o=v("div",{class:"badge-wrap",attrs:{"data-corner":t.corner}},r,i);e.appendChild(o);let s=U(o,t.topLayer),a=!1,c=!1,u=-1,l=0,m=0,d=0,p=0,b=y=>{if(y.button!==0)return;let E=o.getBoundingClientRect();u=y.pointerId,a=!0,c=!1,l=y.clientX-E.left,m=y.clientY-E.top,d=y.clientX,p=y.clientY;try{r.setPointerCapture(y.pointerId)}catch{}},f=y=>{!a||y.pointerId!==u||!c&&Math.abs(y.clientX-d)<Ne&&Math.abs(y.clientY-p)<Ne||(c=!0,o.setAttribute("data-dragging",""),o.style.left=`${y.clientX-l}px`,o.style.top=`${y.clientY-m}px`,o.style.right="auto",o.style.bottom="auto")},h=y=>{if(!a||y.pointerId!==u)return;a=!1,u=-1;try{r.releasePointerCapture(y.pointerId)}catch{}if(!c){t.onOpen();return}let E=o.getBoundingClientRect(),N=_t(E.left+E.width/2,E.top+E.height/2);g(),w(N),t.onCorner(N)};function g(){o.removeAttribute("data-dragging"),o.style.left="",o.style.top="",o.style.right="",o.style.bottom=""}function w(y){o.setAttribute("data-corner",y)}return r.addEventListener("pointerdown",b),r.addEventListener("pointermove",f),r.addEventListener("pointerup",h),r.addEventListener("pointercancel",()=>{a=!1,u=-1,g()}),r.addEventListener("click",y=>y.preventDefault()),{surface:s,setCount(y){n.textContent=String(y),n.toggleAttribute("hidden",y<=0),r.setAttribute("aria-label",y>0?`${t.labels.badge} \xB7 ${y} ${t.labels.reports}`:t.labels.badge)},setCorner:w,destroy(){s.destroy()}}}function _t(e,t){let n=e<window.innerWidth/2;return t<window.innerHeight/2?n?"top-left":"top-right":n?"bottom-left":"bottom-right"}var Bt=[[/Edg\/(\d+)/,"Edge"],[/OPR\/(\d+)/,"Opera"],[/Firefox\/(\d+)/,"Firefox"],[/Chrome\/(\d+)/,"Chrome"],[/Version\/(\d+).*Safari/,"Safari"]],Ut=[[/Windows NT/,"Windows"],[/Android/,"Android"],[/(iPhone|iPad|iPod)/,"iOS"],[/Mac OS X/,"macOS"],[/(Linux|X11)/,"Linux"]];function Me(e){let t="";for(let[r,i]of Bt){let o=r.exec(e);if(o){t=`${i} ${o[1]}`;break}}let n="";for(let[r,i]of Ut)if(r.test(e)){n=i;break}return t&&n?`${t} on ${n}`:t||n}var C={author:80,comment:4e3,page:2e3,title:200,selector:500,elementText:120,client:80,attrValue:80,classes:6,ancestors:6,pathDepth:20,consoleEntries:20,consoleMessage:500,networkEntries:5,networkPath:200,requestId:100,contextKeys:10,contextKey:200,contextValue:200};function A(e,t){return e.length<=t?e:e.slice(0,t)}function G(e){return e.replace(/\s+/g," ").trim()}var Ie=["bug","design","question"],fe=["bottom-right","bottom-left","top-right","top-left"],me={badge:"Report a problem",close:"Hide",reports:"reports on this page",panel:"New report",comment:"What happened?",commentPlaceholder:"Describe it in one sentence",type:"Type",typeBug:"Bug",typeDesign:"Design",typeQuestion:"Question",name:"Your name",namePlaceholder:"Your name",reportingAs:"Reporting as",changeName:"change",send:"Send",sending:"Sending\u2026",sendHint:"Ctrl/Cmd + Enter",cancel:"Cancel",point:"Point at something",pickerHint:"Click the element to report \xB7 Esc to cancel",undo:"Undo",clear:"Clear",noScreenshot:"The screenshot could not be captured. The report can still be sent without an image.",commentRequired:"A comment is required.",nameRequired:"A name is required.",pageUnknown:"The page is unknown.",sendFailed:"Sending failed.",rateLimited:"Too many reports. Try again in a moment.",retryIn:"retry in",sent:"Sent",sentPending:"Sent, comment pending",openReport:"open",pin:"Report",from:"from"},pe={keys:10,key:200,value:200};function De(e){return{endpoint:typeof e?.endpoint=="string"?e.endpoint:"",reporter:Ht(e?.reporter),context:qt(e?.context),labels:{...me,...jt(e?.labels)},position:fe.includes(e?.position)?e.position:"bottom-right",shortcut:Wt(e?.shortcut),origins:zt(e?.network?.origins),theme:e?.theme==="light"||e?.theme==="dark"?e.theme:"auto"}}function Ht(e){let t=typeof e?.name=="string"?e.name.trim():"";return t?{name:t}:null}function qt(e){if(!e||typeof e!="object")return{};let t={};for(let[n,r]of Object.entries(e)){if(Object.keys(t).length>=pe.keys)break;!n||r===null||r===void 0||(t[n.slice(0,pe.key)]=String(r).slice(0,pe.value))}return t}function jt(e){if(!e||typeof e!="object")return{};let t={};for(let[n,r]of Object.entries(e))typeof r=="string"&&r&&(t[n]=r);return t}function Wt(e){let t=typeof e=="string"?e.trim():"";return t.length===1?t.toLowerCase():"f"}function zt(e){let t=typeof location<"u"?location.origin:"";if(!Array.isArray(e)||e.length===0)return t?[t]:[];let n=[];for(let r of e)if(!(typeof r!="string"||!r))try{n.push(new URL(r,t||void 0).origin)}catch{}return n}function Fe(e){let t={type:e.type,author:A(G(e.author),C.author),comment:A(e.comment.trim(),C.comment),page:A(e.page,C.page),viewport:{w:Math.round(e.viewport.w),h:Math.round(e.viewport.h),dpr:Kt(e.viewport.dpr)},client:A(Me(e.userAgent??""),C.client),console:Yt(e.console??[])},n=G(e.title??"");n&&(t.title=A(n,C.title));let r=(e.selector??"").trim();if(r&&(t.selector=A(r,C.selector)),e.element){let s=e.element,a={tag:s.tag.toLowerCase(),text:A(G(s.text),C.elementText)};s.xpath&&(a.xpath=A(s.xpath,C.selector)),s.attrs&&Object.keys(s.attrs).length&&(a.attrs=s.attrs),s.classes?.length&&(a.classes=s.classes),s.ancestors?.length&&(a.ancestors=s.ancestors),s.heading&&(a.heading=A(G(s.heading),C.elementText)),t.element=a}e.click&&(t.click={x:Math.round(e.click.x),y:Math.round(e.click.y)});let i=Vt(e.context??{});Object.keys(i).length&&(t.context=i);let o=Xt(e.network??[]);return o.length&&(t.network=o),e.rect&&(t.rect={x:Math.round(e.rect.x),y:Math.round(e.rect.y),w:Math.round(e.rect.w),h:Math.round(e.rect.h)}),t}function Oe(e,t=me){return e.author?e.comment?e.page?null:t.pageUnknown:t.commentRequired:t.nameRequired}function Vt(e){let t={};for(let[n,r]of Object.entries(e)){if(Object.keys(t).length>=C.contextKeys)break;n&&(t[A(n,C.contextKey)]=A(String(r),C.contextValue))}return t}function Xt(e){return e.slice(-C.networkEntries).map(t=>{let n={method:t.method,path:A(t.path,C.networkPath),status:t.status,at:t.at};return t.requestId&&(n.requestId=A(t.requestId,C.requestId)),n})}function Yt(e){return e.slice(-C.consoleEntries).map(n=>({level:n.level,message:A(n.message,C.consoleMessage),at:n.at}))}function Kt(e){return Math.round(e*100)/100}var je="[modern-screenshot]",H=typeof window<"u",Gt=H&&"Worker"in window,Qr=H&&"atob"in window,Zr=H&&"btoa"in window,be=H?window.navigator?.userAgent:"",We=be.includes("Chrome"),oe=be.includes("AppleWebKit")&&!We,ye=be.includes("Firefox"),Jt=e=>e&&"__CONTEXT__"in e,Qt=e=>e.constructor.name==="CSSFontFaceRule",Zt=e=>e.constructor.name==="CSSImportRule",en=e=>e.constructor.name==="CSSLayerBlockRule",$=e=>e.nodeType===1,ee=e=>typeof e.className=="object",ze=e=>e.tagName==="image",tn=e=>e.tagName==="use",J=e=>$(e)&&typeof e.style<"u"&&!ee(e),nn=e=>e.nodeType===8,rn=e=>e.nodeType===3,Y=e=>e.tagName==="IMG",ie=e=>e.tagName==="VIDEO",on=e=>e.tagName==="CANVAS",an=e=>e.tagName==="TEXTAREA",sn=e=>e.tagName==="INPUT",ln=e=>e.tagName==="STYLE",cn=e=>e.tagName==="SCRIPT",un=e=>e.tagName==="SELECT",dn=e=>e.tagName==="SLOT",pn=e=>e.tagName==="IFRAME",fn=(...e)=>console.warn(je,...e);function mn(e){let t=e?.createElement?.("canvas");return t&&(t.height=t.width=1),!!t&&"toDataURL"in t&&!!t.toDataURL("image/webp").includes("image/webp")}var ge=e=>e.startsWith("data:");function Ve(e,t){if(e.match(/^[a-z]+:\/\//i))return e;if(H&&e.match(/^\/\//))return window.location.protocol+e;if(e.match(/^[a-z]+:/i)||!H)return e;let n=ae().implementation.createHTMLDocument(),r=n.createElement("base"),i=n.createElement("a");return n.head.appendChild(r),n.body.appendChild(i),t&&(r.href=t),i.href=e,i.href}function ae(e){return(e&&$(e)?e?.ownerDocument:e)??window.document}var se="http://www.w3.org/2000/svg";function gn(e,t,n){let r=ae(n).createElementNS(se,"svg");return r.setAttributeNS(null,"width",e.toString()),r.setAttributeNS(null,"height",t.toString()),r.setAttributeNS(null,"viewBox",`0 0 ${e} ${t}`),r}function hn(e,t){let n=new XMLSerializer().serializeToString(e);return t&&(n=n.replace(/[\u0000-\u0008\v\f\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu,"")),`data:image/svg+xml;charset=utf-8,${encodeURIComponent(n)}`}function bn(e,t){return new Promise((n,r)=>{let i=new FileReader;i.onload=()=>n(i.result),i.onerror=()=>r(i.error),i.onabort=()=>r(new Error(`Failed read blob to ${t}`)),t==="dataUrl"?i.readAsDataURL(e):t==="arrayBuffer"&&i.readAsArrayBuffer(e)})}var yn=e=>bn(e,"dataUrl");function X(e,t){let n=ae(t).createElement("img");return n.decoding="sync",n.loading="eager",n.src=e,n}function Q(e,t){return new Promise(n=>{let{timeout:r,ownerDocument:i,onError:o,onWarn:s}=t??{},a=typeof e=="string"?X(e,ae(i)):e,c=null,u=null;function l(){n(a),c&&clearTimeout(c),u?.()}if(r&&(c=setTimeout(l,r)),ie(a)){let m=a.currentSrc||a.src;if(!m)return a.poster?Q(a.poster,t).then(n):l();if(a.readyState>=2)return l();let d=l,p=b=>{s?.("Failed video load",m,b),o?.(b),l()};u=()=>{a.removeEventListener("loadeddata",d),a.removeEventListener("error",p)},a.addEventListener("loadeddata",d,{once:!0}),a.addEventListener("error",p,{once:!0})}else{let m=ze(a)?a.href.baseVal:a.currentSrc||a.src;if(!m)return l();let d=async()=>{if(Y(a)&&"decode"in a)try{await a.decode()}catch(b){s?.("Failed to decode image, trying to render anyway",a.dataset.originalSrc||m,b)}l()},p=b=>{s?.("Failed image load",a.dataset.originalSrc||m,b),l()};if(Y(a)&&a.complete)return d();u=()=>{a.removeEventListener("load",d),a.removeEventListener("error",p)},a.addEventListener("load",d,{once:!0}),a.addEventListener("error",p,{once:!0})}})}async function wn(e,t){J(e)&&(Y(e)||ie(e)?await Q(e,t):await Promise.all(["img","video"].flatMap(n=>Array.from(e.querySelectorAll(n)).map(r=>Q(r,t)))))}var Xe=(function(){let t=0,n=()=>`0000${(Math.random()*36**4<<0).toString(36)}`.slice(-4);return()=>(t+=1,`u${n()}${t}`)})();function Ye(e){return e?.split(",").map(t=>t.trim().replace(/"|'/g,"").toLowerCase()).filter(Boolean)}var $e=0;function vn(e){let t=`${je}[#${$e}]`;return $e++,{time:n=>e&&console.time(`${t} ${n}`),timeEnd:n=>e&&console.timeEnd(`${t} ${n}`),warn:(...n)=>e&&fn(...n)}}function xn(e){return{cache:e?"no-cache":"force-cache"}}async function Ke(e,t){return Jt(e)?e:kn(e,{...t,autoDestruct:!0})}async function kn(e,t){let{scale:n=1,workerUrl:r,workerNumber:i=1}=t||{},o=!!t?.debug,s=t?.features??!0,a=e.ownerDocument??(H?window.document:void 0),c=e.ownerDocument?.defaultView??(H?window:void 0),u=new Map,l={width:0,height:0,quality:1,type:"image/png",scale:n,backgroundColor:null,style:null,filter:null,maximumCanvasSize:0,timeout:3e4,progress:null,debug:o,fetch:{requestInit:xn(t?.fetch?.bypassingCache),placeholderImage:"data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",bypassingCache:!1,...t?.fetch},fetchFn:null,font:{},drawImageInterval:100,workerUrl:null,workerNumber:i,onCloneEachNode:null,onCloneNode:null,onEmbedNode:null,onCreateForeignObjectSvg:null,includeStyleProperties:null,autoDestruct:!1,...t,__CONTEXT__:!0,log:vn(o),node:e,ownerDocument:a,ownerWindow:c,dpi:n===1?null:96*n,svgStyleElement:Ge(a),svgDefsElement:a?.createElementNS(se,"defs"),svgStyles:new Map,defaultComputedStyles:new Map,workers:[...Array.from({length:Gt&&r&&i?i:0})].map(()=>{try{let p=new Worker(r);return p.onmessage=async b=>{let{url:f,result:h}=b.data;h?u.get(f)?.resolve?.(h):u.get(f)?.reject?.(new Error(`Error receiving message from worker: ${f}`))},p.onmessageerror=b=>{let{url:f}=b.data;u.get(f)?.reject?.(new Error(`Error receiving message from worker: ${f}`))},p}catch(p){return l.log.warn("Failed to new Worker",p),null}}).filter(Boolean),fontFamilies:new Map,fontCssTexts:new Map,acceptOfImage:`${[mn(a)&&"image/webp","image/svg+xml","image/*","*/*"].filter(Boolean).join(",")};q=0.8`,requests:u,drawImageCount:0,tasks:[],features:s,isEnable:p=>p==="restoreScrollPosition"?typeof s=="boolean"?!1:s[p]??!1:typeof s=="boolean"?s:s[p]??!0,shadowRoots:[]};l.log.time("wait until load"),await wn(e,{timeout:l.timeout,onWarn:l.log.warn}),l.log.timeEnd("wait until load");let{width:m,height:d}=En(e,l);return l.width=m,l.height=d,l}function Ge(e){if(!e)return;let t=e.createElement("style"),n=t.ownerDocument.createTextNode(`
.______background-clip--text {
  background-clip: text;
  -webkit-background-clip: text;
}
`);return t.appendChild(n),t}function En(e,t){let{width:n,height:r}=t;if($(e)&&(!n||!r)){let i=e.getBoundingClientRect();n=n||i.width||Number(e.getAttribute("width"))||0,r=r||i.height||Number(e.getAttribute("height"))||0}return{width:n,height:r}}async function Sn(e,t){let{log:n,timeout:r,drawImageCount:i,drawImageInterval:o}=t;n.time("image to canvas");let s=await Q(e,{timeout:r,onWarn:t.log.warn}),{canvas:a,context2d:c}=Cn(e.ownerDocument,t),u=()=>{try{c?.drawImage(s,0,0,a.width,a.height)}catch(l){t.log.warn("Failed to drawImage",l)}};if(u(),t.isEnable("fixSvgXmlDecode"))for(let l=0;l<i;l++)await new Promise(m=>{setTimeout(()=>{c?.clearRect(0,0,a.width,a.height),u(),m()},l+o)});return t.drawImageCount=0,n.timeEnd("image to canvas"),a}function Cn(e,t){let{width:n,height:r,scale:i,backgroundColor:o,maximumCanvasSize:s}=t,a=e.createElement("canvas");a.width=Math.floor(n*i),a.height=Math.floor(r*i),a.style.width=`${n}px`,a.style.height=`${r}px`,s&&(a.width>s||a.height>s)&&(a.width>s&&a.height>s?a.width>a.height?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s):a.width>s?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s));let c=a.getContext("2d");return c&&o&&(c.fillStyle=o,c.fillRect(0,0,a.width,a.height)),{canvas:a,context2d:c}}function Je(e,t){if(e.ownerDocument)try{let o=e.toDataURL();if(o!=="data:,")return X(o,e.ownerDocument)}catch(o){t.log.warn("Failed to clone canvas",o)}let n=e.cloneNode(!1),r=e.getContext("2d"),i=n.getContext("2d");try{return r&&i&&i.putImageData(r.getImageData(0,0,e.width,e.height),0,0),n}catch(o){t.log.warn("Failed to clone canvas",o)}return n}function Tn(e,t){try{if(e?.contentDocument?.documentElement)return we(e.contentDocument.documentElement,t)}catch(n){t.log.warn("Failed to clone iframe",n)}return e.cloneNode(!1)}function Pn(e){let t=e.cloneNode(!1);return e.currentSrc&&e.currentSrc!==e.src&&(t.src=e.currentSrc,t.srcset=""),t.loading==="lazy"&&(t.loading="eager"),t}async function Rn(e,t){if(e.ownerDocument&&!e.currentSrc&&e.poster)return X(e.poster,e.ownerDocument);let n=e.cloneNode(!1);n.crossOrigin="anonymous",e.currentSrc&&e.currentSrc!==e.src&&(n.src=e.currentSrc);let r=n.ownerDocument;if(r){let i=!0;if(await Q(n,{onError:()=>i=!1,onWarn:t.log.warn}),!i)return e.poster?X(e.poster,e.ownerDocument):n;n.currentTime=e.currentTime,await new Promise(s=>{n.addEventListener("seeked",s,{once:!0})});let o=r.createElement("canvas");o.width=e.offsetWidth,o.height=e.offsetHeight;try{let s=o.getContext("2d");s&&s.drawImage(n,0,0,o.width,o.height)}catch(s){return t.log.warn("Failed to clone video",s),e.poster?X(e.poster,e.ownerDocument):n}return Je(o,t)}return n}function An(e,t){return on(e)?Je(e,t):pn(e)?Tn(e,t):Y(e)?Pn(e):ie(e)?Rn(e,t):e.cloneNode(!1)}function Nn(e){let t=e.sandbox;if(!t){let{ownerDocument:n}=e;try{n&&(t=n.createElement("iframe"),t.id=`__SANDBOX__${Xe()}`,t.width="0",t.height="0",t.style.visibility="hidden",t.style.position="fixed",n.body.appendChild(t),t.srcdoc='<!DOCTYPE html><meta charset="UTF-8"><title></title><body>',e.sandbox=t)}catch(r){e.log.warn("Failed to getSandBox",r)}}return t}var Ln=["width","height","-webkit-text-fill-color"],Mn=["stroke","fill"];function Qe(e,t,n){let{defaultComputedStyles:r}=n,i=e.nodeName.toLowerCase(),o=ee(e)&&i!=="svg",s=o?Mn.map(f=>[f,e.getAttribute(f)]).filter(([,f])=>f!==null):[],a=[o&&"svg",i,s.map((f,h)=>`${f}=${h}`).join(","),t].filter(Boolean).join(":");if(r.has(a))return r.get(a);let u=Nn(n)?.contentWindow;if(!u)return new Map;let l=u?.document,m,d;o?(m=l.createElementNS(se,"svg"),d=m.ownerDocument.createElementNS(m.namespaceURI,i),s.forEach(([f,h])=>{d.setAttributeNS(null,f,h)}),m.appendChild(d)):m=d=l.createElement(i),d.textContent=" ",l.body.appendChild(m);let p=u.getComputedStyle(d,t),b=new Map;for(let f=p.length,h=0;h<f;h++){let g=p.item(h);Ln.includes(g)||b.set(g,p.getPropertyValue(g))}return l.body.removeChild(m),r.set(a,b),b}function Ze(e,t,n){let r=new Map,i=[],o=new Map;if(n)for(let a of n)s(a);else for(let a=e.length,c=0;c<a;c++){let u=e.item(c);s(u)}for(let a=i.length,c=0;c<a;c++)o.get(i[c])?.forEach((u,l)=>r.set(l,u));function s(a){let c=e.getPropertyValue(a),u=e.getPropertyPriority(a),l=a.lastIndexOf("-"),m=l>-1?a.substring(0,l):void 0;if(m){let d=o.get(m);d||(d=new Map,o.set(m,d)),d.set(a,[c,u])}t.get(a)===c&&!u||(m?i.push(m):r.set(a,[c,u]))}return r}function In(e,t,n,r){let{ownerWindow:i,includeStyleProperties:o,currentParentNodeStyle:s}=r,a=t.style,c=i.getComputedStyle(e),u=Qe(e,null,r);s?.forEach((m,d)=>{u.delete(d)});let l=Ze(c,u,o);l.delete("transition-property"),l.delete("all"),l.delete("d"),l.delete("content"),n&&(l.delete("position"),l.delete("margin-top"),l.delete("margin-right"),l.delete("margin-bottom"),l.delete("margin-left"),l.delete("margin-block-start"),l.delete("margin-block-end"),l.delete("margin-inline-start"),l.delete("margin-inline-end"),l.set("box-sizing",["border-box",""])),l.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text"),We&&(l.has("font-kerning")||l.set("font-kerning",["normal",""]),(l.get("overflow-x")?.[0]==="hidden"||l.get("overflow-y")?.[0]==="hidden")&&l.get("text-overflow")?.[0]==="ellipsis"&&e.scrollWidth===e.clientWidth&&l.set("text-overflow",["clip",""]));for(let m=a.length,d=0;d<m;d++)a.removeProperty(a.item(d));return l.forEach(([m,d],p)=>{a.setProperty(p,m,d)}),l}function Dn(e,t){(an(e)||sn(e)||un(e))&&t.setAttribute("value",e.value)}var Fn=["::before","::after"],On=["::-webkit-scrollbar","::-webkit-scrollbar-button","::-webkit-scrollbar-thumb","::-webkit-scrollbar-track","::-webkit-scrollbar-track-piece","::-webkit-scrollbar-corner","::-webkit-resizer"];function $n(e,t,n,r,i){let{ownerWindow:o,svgStyleElement:s,svgStyles:a,currentNodeStyle:c}=r;if(!s||!o)return;function u(l){let m=o.getComputedStyle(e,l),d=m.getPropertyValue("content");if(!d||d==="none")return;i?.(d),d=d.replace(/(')|(")|(counter\(.+\))/g,"");let p=[Xe()],b=Qe(e,l,r);c?.forEach((y,E)=>{b.delete(E)});let f=Ze(m,b,r.includeStyleProperties);f.delete("content"),f.delete("-webkit-locale"),f.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text");let h=[`content: '${d}';`];if(f.forEach(([y,E],N)=>{h.push(`${N}: ${y}${E?" !important":""};`)}),h.length===1)return;try{t.className=[t.className,...p].join(" ")}catch(y){r.log.warn("Failed to copyPseudoClass",y);return}let g=h.join(`
  `),w=a.get(g);w||(w=[],a.set(g,w)),w.push(`.${p[0]}${l}`)}Fn.forEach(u),n&&On.forEach(u)}var _e=new Set(["symbol"]);async function Be(e,t,n,r,i){if($(n)&&(ln(n)||cn(n))||r.filter&&!r.filter(n))return;_e.has(t.nodeName)||_e.has(n.nodeName)?r.currentParentNodeStyle=void 0:r.currentParentNodeStyle=r.currentNodeStyle;let o=await we(n,r,!1,i);r.isEnable("restoreScrollPosition")&&_n(e,o),t.appendChild(o)}async function Ue(e,t,n,r){let i=e.firstChild;$(e)&&e.shadowRoot&&(i=e.shadowRoot?.firstChild,n.shadowRoots.push(e.shadowRoot));for(let o=i;o;o=o.nextSibling)if(!nn(o))if($(o)&&dn(o)&&typeof o.assignedNodes=="function"){let s=o.assignedNodes();for(let a=0;a<s.length;a++)await Be(e,t,s[a],n,r)}else await Be(e,t,o,n,r)}function _n(e,t){if(!J(e)||!J(t))return;let{scrollTop:n,scrollLeft:r}=e;if(!n&&!r)return;let{transform:i}=t.style,o=new DOMMatrix(i),{a:s,b:a,c,d:u}=o;o.a=1,o.b=0,o.c=0,o.d=1,o.translateSelf(-r,-n),o.a=s,o.b=a,o.c=c,o.d=u,t.style.transform=o.toString()}function Bn(e,t){let{backgroundColor:n,width:r,height:i,style:o}=t,s=e.style;if(n&&s.setProperty("background-color",n,"important"),r&&s.setProperty("width",`${r}px`,"important"),i&&s.setProperty("height",`${i}px`,"important"),o)for(let a in o)s[a]=o[a]}var Un=/^[\w-:]+$/;async function we(e,t,n=!1,r){let{ownerDocument:i,ownerWindow:o,fontFamilies:s,onCloneEachNode:a}=t;if(i&&rn(e))return r&&/\S/.test(e.data)&&r(e.data),i.createTextNode(e.data);if(i&&o&&$(e)&&(J(e)||ee(e))){let u=await An(e,t);if(t.isEnable("removeAbnormalAttributes")){let f=u.getAttributeNames();for(let h=f.length,g=0;g<h;g++){let w=f[g];Un.test(w)||u.removeAttribute(w)}}let l=t.currentNodeStyle=In(e,u,n,t);n&&Bn(u,t);let m=!1;if(t.isEnable("copyScrollbar")){let f=[l.get("overflow-x")?.[0],l.get("overflow-y")?.[0]];m=f.includes("scroll")||(f.includes("auto")||f.includes("overlay"))&&(e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth)}let d=l.get("text-transform")?.[0],p=Ye(l.get("font-family")?.[0]),b=p?f=>{d==="uppercase"?f=f.toUpperCase():d==="lowercase"?f=f.toLowerCase():d==="capitalize"&&(f=f[0].toUpperCase()+f.substring(1)),p.forEach(h=>{let g=s.get(h);g||s.set(h,g=new Set),f.split("").forEach(w=>g.add(w))})}:void 0;return $n(e,u,m,t,b),Dn(e,u),ie(e)||await Ue(e,u,t,b),await a?.(u),u}let c=e.cloneNode(!1);return await Ue(e,c,t),await a?.(c),c}function Hn(e){if(e.ownerDocument=void 0,e.ownerWindow=void 0,e.svgStyleElement=void 0,e.svgDefsElement=void 0,e.svgStyles.clear(),e.defaultComputedStyles.clear(),e.sandbox){try{e.sandbox.remove()}catch(t){e.log.warn("Failed to destroyContext",t)}e.sandbox=void 0}e.workers=[],e.fontFamilies.clear(),e.fontCssTexts.clear(),e.requests.clear(),e.tasks=[],e.shadowRoots=[]}function qn(e){let{url:t,timeout:n,responseType:r,...i}=e,o=new AbortController,s=n?setTimeout(()=>o.abort(),n):void 0;return fetch(t,{signal:o.signal,...i}).then(a=>{if(!a.ok)throw new Error("Failed fetch, not 2xx response",{cause:a});switch(r){case"arrayBuffer":return a.arrayBuffer();case"dataUrl":return a.blob().then(yn);case"text":default:return a.text()}}).finally(()=>clearTimeout(s))}function Z(e,t){let{url:n,requestType:r="text",responseType:i="text",imageDom:o}=t,s=n,{timeout:a,acceptOfImage:c,requests:u,fetchFn:l,fetch:{requestInit:m,bypassingCache:d,placeholderImage:p},font:b,workers:f,fontFamilies:h}=e;r==="image"&&(oe||ye)&&e.drawImageCount++;let g=u.get(n);if(!g){d&&d instanceof RegExp&&d.test(s)&&(s+=(/\?/.test(s)?"&":"?")+new Date().getTime());let w=r.startsWith("font")&&b&&b.minify,y=new Set;w&&r.split(";")[1].split(",").forEach(D=>{h.has(D)&&h.get(D).forEach(S=>y.add(S))});let E=w&&y.size,N={url:s,timeout:a,responseType:E?"arrayBuffer":i,headers:r==="image"?{accept:c}:void 0,...m};g={type:r,resolve:void 0,reject:void 0,response:null},g.response=(async()=>{if(l&&r==="image"){let M=await l(n);if(M)return M}return!oe&&n.startsWith("http")&&f.length?new Promise((M,D)=>{f[u.size&f.length-1].postMessage({rawUrl:n,...N}),g.resolve=M,g.reject=D}):qn(N)})().catch(M=>{if(u.delete(n),r==="image"&&p)return e.log.warn("Failed to fetch image base64, trying to use placeholder image",s),typeof p=="string"?p:p(o);throw M}),u.set(n,g)}return g.response}async function et(e,t,n,r){if(!tt(e))return e;for(let[i,o]of jn(e,t))try{let s=await Z(n,{url:o,requestType:r?"image":"text",responseType:"dataUrl"});e=e.replace(Wn(i),`$1${s}$3`)}catch(s){n.log.warn("Failed to fetch css data url",i,s)}return e}function tt(e){return/url\((['"]?)([^'"]+?)\1\)/.test(e)}var nt=/url\((['"]?)([^'"]+?)\1\)/g;function jn(e,t){let n=[];return e.replace(nt,(r,i,o)=>(n.push([o,Ve(o,t)]),r)),n.filter(([r])=>!ge(r))}function Wn(e){let t=e.replace(/([.*+?^${}()|\[\]\/\\])/g,"\\$1");return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`,"g")}var zn=["background-image","border-image-source","-webkit-border-image","-webkit-mask-image","list-style-image"];function Vn(e,t){return zn.map(n=>{let r=e.getPropertyValue(n);return!r||r==="none"?null:((oe||ye)&&t.drawImageCount++,et(r,null,t,!0).then(i=>{!i||r===i||e.setProperty(n,i,e.getPropertyPriority(n))}))}).filter(Boolean)}function Xn(e,t){if(Y(e)){let n=e.currentSrc||e.src;if(!ge(n))return[Z(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.srcset="",e.dataset.originalSrc=n,e.src=r||"")})];(oe||ye)&&t.drawImageCount++}else if(ee(e)&&!ge(e.href.baseVal)){let n=e.href.baseVal;return[Z(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.dataset.originalSrc=n,e.href.baseVal=r||"")})]}return[]}function Yn(e,t){let{ownerDocument:n,svgDefsElement:r}=t,i=e.getAttribute("href")??e.getAttribute("xlink:href");if(!i)return[];let[o,s]=i.split("#");if(s){let a=`#${s}`,c=t.shadowRoots.reduce((u,l)=>u??l.querySelector(`svg ${a}`),n?.querySelector(`svg ${a}`));if(o&&e.setAttribute("href",a),r?.querySelector(a))return[];if(c)return r?.appendChild(c.cloneNode(!0)),[];if(o)return[Z(t,{url:o,responseType:"text"}).then(u=>{r?.insertAdjacentHTML("beforeend",u)})]}return[]}function rt(e,t){let{tasks:n}=t;$(e)&&((Y(e)||ze(e))&&n.push(...Xn(e,t)),tn(e)&&n.push(...Yn(e,t))),J(e)&&n.push(...Vn(e.style,t)),e.childNodes.forEach(r=>{rt(r,t)})}async function Kn(e,t){let{ownerDocument:n,svgStyleElement:r,fontFamilies:i,fontCssTexts:o,tasks:s,font:a}=t;if(!(!n||!r||!i.size))if(a&&a.cssText){let c=qe(a.cssText,t);r.appendChild(n.createTextNode(`${c}
`))}else{let c=Array.from(n.styleSheets).filter(p=>{try{return"cssRules"in p&&!!p.cssRules.length}catch(b){return t.log.warn(`Error while reading CSS rules from ${p.href}`,b),!1}}),u=n.implementation.createHTMLDocument(""),l=u.createElement("style");u.head.appendChild(l);let m=l.sheet;await Promise.all(c.flatMap(p=>Array.from(p.cssRules).map(async b=>{if(Zt(b)){let f=b.href,h="";try{h=await Z(t,{url:f,requestType:"text",responseType:"text"})}catch(w){t.log.warn(`Error fetch remote css import from ${f}`,w)}let g=h.replace(nt,(w,y,E)=>w.replace(E,Ve(E,f)));for(let w of Jn(g))try{m.insertRule(w,m.cssRules.length)}catch(y){t.log.warn("Error inserting rule from remote css import",{rule:w,error:y})}}}))),m.cssRules.length&&c.push(m);let d=[];c.forEach(p=>{he(p.cssRules,d)}),d.filter(p=>Qt(p)&&tt(p.style.getPropertyValue("src"))&&Ye(p.style.getPropertyValue("font-family"))?.some(b=>i.has(b))).forEach(p=>{let b=p,f=o.get(b.cssText);f?r.appendChild(n.createTextNode(`${f}
`)):s.push(et(b.cssText,b.parentStyleSheet?b.parentStyleSheet.href:null,t).then(h=>{h=qe(h,t),o.set(b.cssText,h),r.appendChild(n.createTextNode(`${h}
`))}))})}}var Gn=/(\/\*[\s\S]*?\*\/)/g,He=/((@.*?keyframes [\s\S]*?){([\s\S]*?}\s*?)})/gi;function Jn(e){if(e==null)return[];let t=[],n=e.replace(Gn,"");for(;;){let o=He.exec(n);if(!o)break;t.push(o[0])}n=n.replace(He,"");let r=/@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi,i=new RegExp("((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})","gi");for(;;){let o=r.exec(n);if(o)i.lastIndex=r.lastIndex;else if(o=i.exec(n),o)r.lastIndex=i.lastIndex;else break;t.push(o[0])}return t}var Qn=/url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g,Zn=/src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;function qe(e,t){let{font:n}=t,r=n?n?.preferredFormat:void 0;return r?e.replace(Zn,i=>{for(;;){let[o,,s]=Qn.exec(i)||[];if(!s)return"";if(s===r)return`src: ${o};`}}):e}function he(e,t=[]){for(let n of Array.from(e))en(n)?t.push(...he(n.cssRules)):"cssRules"in n?he(n.cssRules,t):t.push(n);return t}var er=/\bx?link:?href\s*=\s*["'](?!data:)[^"']+["']/i;function tr(e){return er.test(e.innerHTML)}async function nr(e,t){let n=await Ke(e,t);if($(n.node)&&ee(n.node)&&!tr(n.node))return n.node;let{ownerDocument:r,log:i,tasks:o,svgStyleElement:s,svgDefsElement:a,svgStyles:c,font:u,progress:l,autoDestruct:m,onCloneNode:d,onEmbedNode:p,onCreateForeignObjectSvg:b}=n;i.time("clone node");let f=await we(n.node,n,!0);if(s&&r){let E="";c.forEach((N,M)=>{E+=`${N.join(`,
`)} {
  ${M}
}
`}),s.appendChild(r.createTextNode(E))}i.timeEnd("clone node"),await d?.(f),u!==!1&&$(f)&&(i.time("embed web font"),await Kn(f,n),i.timeEnd("embed web font")),i.time("embed node"),rt(f,n);let h=o.length,g=0,w=async()=>{for(;;){let E=o.pop();if(!E)break;try{await E}catch(N){n.log.warn("Failed to run task",N)}l?.(++g,h)}};l?.(g,h),await Promise.all([...Array.from({length:4})].map(w)),i.timeEnd("embed node"),await p?.(f);let y=rr(f,n);return a&&y.insertBefore(a,y.children[0]),s&&y.insertBefore(s,y.children[0]),m&&Hn(n),await b?.(y),y}function rr(e,t){let{width:n,height:r}=t,i=gn(n,r,e.ownerDocument),o=i.ownerDocument.createElementNS(i.namespaceURI,"foreignObject");return o.setAttributeNS(null,"x","0%"),o.setAttributeNS(null,"y","0%"),o.setAttributeNS(null,"width","100%"),o.setAttributeNS(null,"height","100%"),o.append(e),i.appendChild(o),i}async function ot(e,t){let n=await Ke(e,t),r=await nr(n),i=hn(r,n.isEnable("removeControlCharacter"));n.autoDestruct||(n.svgStyleElement=Ge(n.ownerDocument),n.svgDefsElement=n.ownerDocument?.createElementNS(se,"defs"),n.svgStyles.clear());let o=X(i,r.ownerDocument);return await Sn(o,n)}var or=2;function ir(e){let t=Number.isFinite(e)&&e>0?e:1;return Math.min(t,or)}async function it(e){try{let t=ir(window.devicePixelRatio),n=await ot(document.documentElement,{scale:t,backgroundColor:ar(),timeout:15e3,filter:u=>!(e&&(u===e||e.contains(u)))}),r=Math.max(1,Math.round(window.innerWidth*t)),i=Math.max(1,Math.round(window.innerHeight*t)),o=document.createElement("canvas");o.width=r,o.height=i;let s=o.getContext("2d");if(!s)return null;let a=Math.round(window.scrollX*t),c=Math.round(window.scrollY*t);return s.drawImage(n,a,c,r,i,0,0,r,i),{canvas:o,width:r,height:i,scale:t}}catch(t){return console.debug("[prevly] screenshot failed",t),null}}function at(e){return new Promise(t=>{try{e.toBlob(n=>t(n),"image/png")}catch{t(null)}})}function ar(){try{let e=getComputedStyle(document.body).backgroundColor;if(e&&e!=="rgba(0, 0, 0, 0)"&&e!=="transparent")return e;let t=getComputedStyle(document.documentElement).backgroundColor;if(t&&t!=="rgba(0, 0, 0, 0)"&&t!=="transparent")return t}catch{}return"#ffffff"}var le="#e11d48",st=`
:host {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483647 !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  pointer-events: none !important;
  visibility: visible !important;
  opacity: 1 !important;
  transform: none !important;
  filter: none !important;
  contain: style;
}
* { box-sizing: border-box; }

.root {
  --accent: ${le};
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --line: #e2e8f0;
  --chip: #f1f5f9;
  --chip-on: #0f172a;
  --chip-on-text: #ffffff;
  --shell: #0f172a;
  --shell-text: #ffffff;
  --shadow: 0 8px 28px rgba(15, 23, 42, 0.22);
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 400;
  font-style: normal;
  letter-spacing: normal;
  text-transform: none;
  text-align: left;
  white-space: normal;
  direction: ltr;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
.root[data-theme="dark"] {
  --surface: #1b1b1f;
  --text: #ededef;
  --muted: #9a9aa2;
  --line: #2f2f36;
  --chip: #27272d;
  --chip-on: #ededef;
  --chip-on-text: #1b1b1f;
  --shell: #101014;
  --shell-text: #ededef;
  --shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
}

/* :where keeps this reset at zero specificity: a plain \`.root button\` rule
   outranks every single-class button style below and strips their background. */
:where(.root) button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
:where(.root) button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[hidden] { display: none !important; }

/* A popover surface inherits the UA dialog chrome; every bit of it is reset
   here, and a leftover default background paints a white box over the page. */
.top-layer {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  max-width: none;
  max-height: none;
  overflow: visible;
}
.top-layer::backdrop { background: transparent; }

.overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.badge-wrap {
  position: fixed;
  width: auto;
  height: auto;
  inset: auto;
  pointer-events: auto;
  isolation: isolate;
}
.badge-wrap[data-corner="bottom-right"] { right: 16px; bottom: 16px; }
.badge-wrap[data-corner="bottom-left"] { left: 16px; bottom: 16px; }
.badge-wrap[data-corner="top-right"] { right: 16px; top: 16px; }
.badge-wrap[data-corner="top-left"] { left: 16px; top: 16px; }
.badge-wrap[data-dragging] { transition: none; opacity: .85; }

.badge-button {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: var(--shell);
  color: var(--shell-text);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow);
  touch-action: none;
}
.badge-button:hover { transform: translateY(-1px); }
.badge-icon { display: flex; }
.badge-icon svg { width: 18px; height: 18px; display: block; }
.badge-count {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge-close {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 90ms linear;
}
.badge-wrap:hover .badge-close,
.badge-wrap:focus-within .badge-close { opacity: 1; }
.badge-close-icon svg { width: 10px; height: 10px; display: block; }

.panel-anchor {
  position: fixed;
  inset: auto;
  width: auto;
  height: auto;
  pointer-events: auto;
}
.panel-anchor[data-corner="bottom-right"] { right: 16px; bottom: 66px; }
.panel-anchor[data-corner="bottom-left"] { left: 16px; bottom: 66px; }
.panel-anchor[data-corner="top-right"] { right: 16px; top: 66px; }
.panel-anchor[data-corner="top-left"] { left: 16px; top: 66px; }

.panel-backdrop {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  pointer-events: auto;
}

.panel {
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 12px;
  display: grid;
  gap: 8px;
}
.panel-wide { width: min(880px, 100%); max-height: 100%; overflow: auto; }
.panel-head { display: flex; align-items: center; gap: 8px; }
.panel-title { font-size: 12px; font-weight: 600; color: var(--muted); }
.icon-button {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-button:hover { background: var(--chip); }
.icon-button-glyph svg { width: 12px; height: 12px; display: block; }

.type-row { display: flex; gap: 4px; padding: 2px; background: var(--chip); border-radius: 8px; }
.type-option {
  flex: 1;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
.type-option[aria-checked="true"] { background: var(--chip-on); color: var(--chip-on-text); font-weight: 600; }

.field { display: grid; }
.field-input {
  font: inherit;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: var(--surface);
}
textarea.field-input { min-height: 72px; resize: vertical; }
.field-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.16); }

.author-known { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--muted); }
.link { color: var(--accent); text-decoration: underline; font-size: 12px; }

.error { color: var(--accent); font-size: 12px; min-height: 0; }
.error:empty { display: none; }

.panel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.panel-actions .btn-ghost { margin-right: auto; white-space: nowrap; }
.send-hint { text-align: right; font-size: 11px; color: var(--muted); margin-top: -4px; }
.btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 12px;
  color: var(--text);
}
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-ghost { border-color: transparent; color: var(--muted); display: flex; align-items: center; gap: 5px; padding-left: 6px; }
.btn-ghost:hover { background: var(--chip); }
.btn-icon svg { width: 13px; height: 13px; display: block; }
.btn[disabled] { opacity: .55; cursor: default; }

.canvas-block { display: grid; gap: 8px; }
.canvas-wrap {
  background: var(--chip);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px;
  display: flex;
  justify-content: center;
}
.canvas-wrap canvas {
  max-width: 100%;
  max-height: 44vh;
  width: auto;
  height: auto;
  display: block;
  cursor: crosshair;
  touch-action: none;
  border-radius: 6px;
}
.tools { display: flex; gap: 6px; }
.tool { padding: 4px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); font-size: 12px; }
.notice {
  padding: 8px 10px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
}

.outline {
  position: absolute;
  border: 2px solid var(--accent);
  background: rgba(225, 29, 72, 0.08);
  border-radius: 2px;
  pointer-events: none;
  transition: all 60ms linear;
}
.outline-label {
  position: absolute;
  max-width: 320px;
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.picker-hint {
  position: absolute;
  left: 50%;
  top: 16px;
  transform: translateX(-50%);
  padding: 6px 13px;
  border-radius: 999px;
  background: var(--shell);
  color: var(--shell-text);
  font-size: 12px;
  pointer-events: none;
}

.pin-container { position: absolute; inset: 0; pointer-events: none; }
.pin {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.popover {
  position: absolute;
  width: 260px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: var(--shadow);
  pointer-events: auto;
}
.popover .who { font-weight: 600; }
.popover .when { color: var(--muted); font-size: 11px; margin-left: 6px; }
.popover .body { margin-top: 6px; white-space: pre-wrap; word-break: break-word; }
.popover a { color: var(--accent); font-size: 12px; display: inline-block; margin-top: 8px; }

.toast {
  position: absolute;
  max-width: 320px;
  padding: 9px 13px;
  border-radius: 10px;
  background: var(--shell);
  color: var(--shell-text);
  box-shadow: var(--shadow);
  pointer-events: auto;
}
.toast[data-corner="bottom-right"] { right: 16px; bottom: 66px; }
.toast[data-corner="bottom-left"] { left: 16px; bottom: 66px; }
.toast[data-corner="top-right"] { right: 16px; top: 66px; }
.toast[data-corner="top-left"] { left: 16px; top: 66px; }
.toast a { color: #fda4af; margin-left: 6px; }
`;function ct(e,t){let{labels:n,shot:r}=t,i=[],o=null,s=!1,a="bug",c=v("canvas"),u=r?Math.max(2,Math.round(3*r.scale)):3;r&&(c.width=r.width,c.height=r.height);let l=x=>{if(r){if(x.clearRect(0,0,r.width,r.height),x.drawImage(r.canvas,0,0),x.save(),x.strokeStyle=le,x.fillStyle=le,x.lineWidth=u,x.lineCap="round",x.lineJoin="round",t.rect&&t.rect.w>0&&t.rect.h>0){let R=r.scale;x.strokeRect(t.rect.x*R,t.rect.y*R,t.rect.w*R,t.rect.h*R)}for(let R of i)lt(x,R);o&&lt(x,o),x.restore()}},m=()=>{let x=c.getContext("2d");x&&l(x)},d=x=>{let R=c.getBoundingClientRect(),_=R.width?c.width/R.width:1,j=R.height?c.height/R.height:1;return[(x.clientX-R.left)*_,(x.clientY-R.top)*j]};c.addEventListener("pointerdown",x=>{r&&(x.preventDefault(),c.setPointerCapture(x.pointerId),o={kind:"pen",pts:[d(x)]},m())}),c.addEventListener("pointermove",x=>{o&&(o.pts.push(d(x)),m())});let p=()=>{o&&o.pts.length>=2&&i.push(o),o=null,m()};c.addEventListener("pointerup",p),c.addEventListener("pointercancel",p);let b=v("textarea",{class:"field-input",attrs:{"aria-label":n.comment,placeholder:n.commentPlaceholder,required:"required","data-prevly":"comment"}}),f=Ie.map(x=>v("button",{class:"type-option",text:sr(n,x),attrs:{type:"button",role:"radio","aria-checked":x===a?"true":"false","data-prevly-type":x},on:{click:()=>{a=x;for(let R of f)R.setAttribute("aria-checked",R.getAttribute("data-prevly-type")===x?"true":"false")}}})),h=v("div",{class:"type-row",attrs:{role:"radiogroup","aria-label":n.type}},...f),g=v("input",{class:"field-input",attrs:{"aria-label":n.name,placeholder:n.namePlaceholder,"data-prevly":"author"}});g.value=t.author;let w=v("label",{class:"field"},g),y=v("div",{class:"author-known"},v("span",{text:`${n.reportingAs} ${t.author}`}),v("button",{class:"link",text:n.changeName,attrs:{type:"button","data-prevly":"change-name"},on:{click:()=>{y.setAttribute("hidden",""),w.removeAttribute("hidden"),g.focus()}}}));t.askAuthor?t.author?w.setAttribute("hidden",""):y.setAttribute("hidden",""):(w.setAttribute("hidden",""),y.setAttribute("hidden",""));let E=v("div",{class:"error",attrs:{role:"alert"}}),N=v("button",{class:"btn btn-primary",text:n.send,attrs:{type:"button","aria-label":n.send,"data-prevly":"send"},on:{click:()=>void S()}}),M=v("button",{class:"btn",text:n.cancel,attrs:{type:"button","aria-label":n.cancel,"data-prevly":"cancel"},on:{click:()=>t.onCancel()}}),D=v("button",{class:"btn btn-ghost",attrs:{type:"button","aria-label":n.point,"data-prevly":"point"},on:{click:()=>t.onPick()}},V(Re,"btn-icon"),document.createTextNode(n.point));async function S(){if(s)return;let x=b.value.trim();if(!x){E.textContent=n.commentRequired,b.focus();return}let R=t.askAuthor?g.value.trim():t.author;if(t.askAuthor&&!R){E.textContent=n.nameRequired,w.removeAttribute("hidden"),y.setAttribute("hidden",""),g.focus();return}s=!0,E.textContent="",N.setAttribute("disabled","disabled"),N.textContent=n.sending;let _=null;if(r){let W=document.createElement("canvas");W.width=r.width,W.height=r.height;let K=W.getContext("2d");K&&(l(K),_=await at(W))}let j=await t.onSubmit({type:a,comment:x,author:R,png:_});s=!1,N.removeAttribute("disabled"),N.textContent=n.send,j&&(E.textContent=j)}let P=r?v("div",{class:"canvas-block"},v("div",{class:"canvas-wrap"},c),v("div",{class:"tools"},v("button",{class:"tool",text:n.undo,attrs:{type:"button","aria-label":n.undo},on:{click:()=>{i.pop(),m()}}}),v("button",{class:"tool",text:n.clear,attrs:{type:"button","aria-label":n.clear},on:{click:()=>{i.length=0,m()}}}))):null,T=v("div",{class:r?"panel panel-wide":"panel",attrs:{role:"dialog","aria-modal":"true","aria-label":n.panel,"data-prevly":"panel"}},v("div",{class:"panel-head"},v("span",{class:"panel-title",text:t.heading??n.panel}),v("button",{class:"icon-button",attrs:{type:"button","aria-label":n.cancel},on:{click:()=>t.onCancel()}},V(re,"icon-button-glyph"))),P,t.shotFailed?v("div",{class:"notice",text:n.noScreenshot}):null,h,v("label",{class:"field"},b),w,y,E,v("div",{class:"panel-actions"},t.allowPick?D:null,M,N),v("div",{class:"send-hint",text:n.sendHint}));T.addEventListener("keydown",x=>{x.key!=="Enter"||!(x.metaKey||x.ctrlKey)||(x.preventDefault(),S())});let L=v("div",{class:r?"panel-backdrop":"panel-anchor"},T);r||L.setAttribute("data-corner",t.corner),r&&L.addEventListener("pointerdown",x=>{x.target===L&&t.onCancel()}),e.appendChild(L);let I=U(L,t.topLayer);return I.show(),m(),b.focus(),{close(){I.destroy()},focus(){b.focus()}}}function sr(e,t){return t==="design"?e.typeDesign:t==="question"?e.typeQuestion:e.typeBug}function lt(e,t){let n=t.pts[0];if(n){e.beginPath(),e.moveTo(n[0],n[1]);for(let r=1;r<t.pts.length;r+=1){let i=t.pts[r];i&&e.lineTo(i[0],i[1])}e.stroke()}}var lr=new Set(["role","name","aria-label","rel","href"]);function cr(e,t){let n=lr.has(e);n||(n=e.startsWith("data-")&&te(e));let r=te(t)&&t.length<100;return r||(r=t.startsWith("#")&&te(t.slice(1))),n&&r}function ur(e){return te(e)}function dr(e){return te(e)}function pr(e){return!0}function dt(e,t){if(e.nodeType!==Node.ELEMENT_NODE)throw new Error("Can't generate CSS selector for non-element node type.");if(e.tagName.toLowerCase()==="html")return"html";let n={root:document.body,idName:ur,className:dr,tagName:pr,attr:cr,timeoutMs:1e3,seedMinLength:3,optimizedMinLength:2,maxNumberOfPathChecks:1/0},r=new Date,i={...n,...t},o=br(i.root,n),s,a=0;for(let u of fr(e,i,o)){if(new Date().getTime()-r.getTime()>i.timeoutMs||a>=i.maxNumberOfPathChecks){let m=gr(e,o);if(!m)throw new Error(`Timeout: Can't find a unique selector after ${i.timeoutMs}ms`);return ne(m)}if(a++,ke(u,o)){s=u;break}}if(!s)throw new Error("Selector was not found.");let c=[...mt(s,e,i,o,r)];return c.sort(ve),c.length>0?ne(c[0]):ne(s)}function*fr(e,t,n){let r=[],i=[],o=e,s=0;for(;o&&o!==n;){let a=mr(o,t);for(let c of a)c.level=s;if(r.push(a),o=o.parentElement,s++,i.push(...ft(r)),s>=t.seedMinLength){i.sort(ve);for(let c of i)yield c;i=[]}}i.sort(ve);for(let a of i)yield a}function te(e){if(/^[a-z\-]{3,}$/i.test(e)){let t=e.split(/-|[A-Z]/);for(let n of t)if(n.length<=2||/[^aeiou]{4,}/i.test(n))return!1;return!0}return!1}function mr(e,t){let n=[],r=e.getAttribute("id");r&&t.idName(r)&&n.push({name:"#"+CSS.escape(r),penalty:0});for(let s=0;s<e.classList.length;s++){let a=e.classList[s];t.className(a)&&n.push({name:"."+CSS.escape(a),penalty:1})}for(let s=0;s<e.attributes.length;s++){let a=e.attributes[s];t.attr(a.name,a.value)&&n.push({name:`[${CSS.escape(a.name)}="${CSS.escape(a.value)}"]`,penalty:2})}let i=e.tagName.toLowerCase();if(t.tagName(i)){n.push({name:i,penalty:5});let s=xe(e,i);s!==void 0&&n.push({name:pt(i,s),penalty:10})}let o=xe(e);return o!==void 0&&n.push({name:hr(i,o),penalty:50}),n}function ne(e){let t=e[0],n=t.name;for(let r=1;r<e.length;r++){let i=e[r].level||0;t.level===i-1?n=`${e[r].name} > ${n}`:n=`${e[r].name} ${n}`,t=e[r]}return n}function ut(e){return e.map(t=>t.penalty).reduce((t,n)=>t+n,0)}function ve(e,t){return ut(e)-ut(t)}function xe(e,t){let n=e.parentNode;if(!n)return;let r=n.firstChild;if(!r)return;let i=0;for(;r&&(r.nodeType===Node.ELEMENT_NODE&&(t===void 0||r.tagName.toLowerCase()===t)&&i++,r!==e);)r=r.nextSibling;return i}function gr(e,t){let n=0,r=e,i=[];for(;r&&r!==t;){let o=r.tagName.toLowerCase(),s=xe(r,o);if(s===void 0)return;i.push({name:pt(o,s),penalty:NaN,level:n}),r=r.parentElement,n++}if(ke(i,t))return i}function hr(e,t){return e==="html"?"html":`${e}:nth-child(${t})`}function pt(e,t){return e==="html"?"html":`${e}:nth-of-type(${t})`}function*ft(e,t=[]){if(e.length>0)for(let n of e[0])yield*ft(e.slice(1,e.length),t.concat(n));else yield t}function br(e,t){return e.nodeType===Node.DOCUMENT_NODE?e:e===t.root?e.ownerDocument:e}function ke(e,t){let n=ne(e);switch(t.querySelectorAll(n).length){case 0:throw new Error(`Can't select any node with this selector: ${n}`);case 1:return!0;default:return!1}}function*mt(e,t,n,r,i){if(e.length>2&&e.length>n.optimizedMinLength)for(let o=1;o<e.length-1;o++){if(new Date().getTime()-i.getTime()>n.timeoutMs)return;let a=[...e];a.splice(o,1),ke(a,r)&&r.querySelector(ne(a))===t&&(yield a,yield*mt(a,t,n,r,i))}}var yr=/^(react-aria|radix|headlessui|mui|chakra|mantine|ant-|css-[a-z0-9]{5,}|:r[0-9a-z]+:)/i,wr=/[A-Za-z]+[0-9][A-Za-z0-9]{4,}|_{2,}|[0-9a-f]{8,}/;function q(e){return!e||yr.test(e)?!1:!wr.test(e)}var vr=/^(data-(hovered|focused|focus-visible|pressed|selected|open|state|highlighted|placement|rac)|aria-(expanded|selected|checked|pressed|current|activedescendant|describedby|labelledby|controls|owns))$/;function ce(e,t){return vr.test(e)||e==="style"?!1:e==="class"?t.split(/\s+/).filter(Boolean).every(q):e==="id"&&!q(t)?!1:t.length<=80}function ht(e,t=document){let n=t.body??t.documentElement,r=xr(e,n);if(r&&gt(t,r,e))return A(r,C.selector);let i=kr(e);return i&&gt(t,i,e)?A(i,C.selector):null}function xr(e,t){try{return dt(e,{root:t,timeoutMs:800,seedMinLength:2,optimizedMinLength:2,attr:ce,idName:q,className:q})}catch{return null}}function kr(e){let t=[],n=e;for(;n;){let r=n.parentElement,i=n.tagName.toLowerCase();if(!r){t.unshift(i);break}let o=Array.prototype.indexOf.call(r.children,n)+1;if(t.unshift(`${i}:nth-child(${o})`),n=r,t.length>14)return null}return t.length?t.join(" > "):null}function gt(e,t,n){try{let r=e.querySelectorAll(t);return r.length===1&&r[0]===n}catch{return!1}}function ue(e){let t=(e.textContent??"").replace(/\s+/g," ").trim();return A(t,C.elementText)}function bt(e){let t=e.tagName.toLowerCase(),n=typeof e.className=="string"?e.className.trim().split(/\s+/)[0]:"",r=e.id?`#${e.id}`:"";return`${t}${r}${n?`.${n}`:""}`}var yt=["pointerdown","pointerup","mousedown","mouseup","click","contextmenu"];function wt(e,t){let n=v("div",{class:"outline",attrs:{hidden:""}}),r=v("div",{class:"outline-label",attrs:{hidden:""}}),i=v("div",{class:"picker-hint",text:t.pickerHint,attrs:{hidden:""}});e.append(n,r,i);let o=!1,s=null,a=null,c=null,u="",l=(h,g)=>{let w=document.elementFromPoint(h,g);return!w||w===document.documentElement?null:w},m=h=>{let g=h.getBoundingClientRect();n.removeAttribute("hidden"),n.style.left=`${g.left}px`,n.style.top=`${g.top}px`,n.style.width=`${g.width}px`,n.style.height=`${g.height}px`;let w=ue(h);r.textContent=`${bt(h)}${w?` \u2014 ${w.slice(0,60)}`:""}`,r.removeAttribute("hidden");let y=g.top>=24;r.style.left=`${Math.max(4,Math.min(g.left,window.innerWidth-330))}px`,r.style.top=y?`${g.top-22}px`:`${Math.min(g.bottom+4,window.innerHeight-24)}px`},d=h=>{if(!o)return;let g=l(h.clientX,h.clientY);!g||g===s||(s=g,m(g))},p=()=>{o&&s&&m(s)},b=h=>{if(!o||(h.preventDefault(),h.stopPropagation(),h.type!=="click"))return;let g=h,w=l(g.clientX,g.clientY)??s;if(!w)return;let y=w.getBoundingClientRect(),E=a;f(),E?.({el:w,click:{x:g.clientX,y:g.clientY},rect:{x:y.left,y:y.top,w:y.width,h:y.height}})};function f(){if(o){o=!1,s=null,a=null,c=null,n.setAttribute("hidden",""),r.setAttribute("hidden",""),i.setAttribute("hidden",""),document.documentElement.style.cursor=u,document.removeEventListener("mousemove",d,!0),window.removeEventListener("scroll",p,!0),window.removeEventListener("resize",p,!0);for(let h of yt)document.removeEventListener(h,b,!0)}}return{isActive:()=>o,start(h,g){o&&f(),o=!0,a=h,c=g,u=document.documentElement.style.cursor,document.documentElement.style.cursor="crosshair",i.removeAttribute("hidden"),document.addEventListener("mousemove",d,!0),window.addEventListener("scroll",p,!0),window.addEventListener("resize",p,!0);for(let w of yt)document.addEventListener(w,b,!0)},cancel(){let h=c;f(),h?.()}}}function Ee(e){return`${e.pathname}${e.search}`}function Er(e,t){return e.filter(n=>n&&n.page===t).slice().sort(Cr)}function vt(e,t,n,r){let i=[],o=[];return Er(e,t).forEach((s,a)=>{let c=a+1,u=s.selector?Sr(n,s.selector):null;u&&(!r||!r.contains(u))?i.push({item:s,n:c,el:u}):o.push({item:s,n:c})}),{matched:i,orphans:o}}function Sr(e,t){try{return e.querySelector(t)}catch{return null}}function Cr(e,t){let n=Date.parse(e.created_at??""),r=Date.parse(t.created_at??"");return Number.isFinite(n)&&Number.isFinite(r)&&n!==r?n-r:String(e.id??"").localeCompare(String(t.id??""))}function xt(e,t=Date.now()){let n=Date.parse(e);if(!Number.isFinite(n))return"";let r=Math.max(0,Math.round((t-n)/1e3));return r<60?"just now":r<3600?`${Math.floor(r/60)} min ago`:r<86400?`${Math.floor(r/3600)} h ago`:r<30*86400?`${Math.floor(r/86400)} d ago`:new Date(n).toLocaleDateString()}function kt(e,t,n){let r=v("div",{class:"pin-container"});e.append(r);let i=[],o="",s=!0,a=[],c=[],u=new Map,l=null,m=!1,d=0,p=0,b=()=>{for(let S of a){let P=u.get(S.item.id);if(!P)continue;if(!S.el.isConnected){P.setAttribute("hidden","");continue}let T=S.el.getBoundingClientRect();if(T.bottom<-40||T.top>window.innerHeight+40||T.right<-40||T.left>window.innerWidth+40||T.width===0&&T.height===0){P.setAttribute("hidden","");continue}P.removeAttribute("hidden");let I=Math.min(Math.max(T.right-11,2),window.innerWidth-24),x=Math.min(Math.max(T.top-11,2),window.innerHeight-24);P.style.left=`${I}px`,P.style.top=`${x}px`}l&&N(l)},f=()=>{d||(d=requestAnimationFrame(()=>{d=0,s&&b()}))},h=()=>{let S=vt(i,o,document,t);a=S.matched,c=S.orphans;let P=new Map;for(let T of a){let L=u.get(T.item.id),I=L??g(T);I.textContent=String(T.n),P.set(T.item.id,I),L||r.append(I)}for(let[T,L]of u)P.has(T)||L.remove();u=P,r.toggleAttribute("hidden",!s),s&&b()},g=S=>v("button",{class:"pin",attrs:{type:"button","aria-label":`${n.pin} ${S.n} ${n.from} ${S.item.author}`,"data-prevly-pin":S.item.id},on:{click:P=>{P.stopPropagation(),y(S)},mouseenter:()=>{m||w(S)},mouseleave:()=>{m||E()}}}),w=S=>{E();let P=S.item,T=v("div",{class:"popover",attrs:{role:"dialog","aria-label":`${n.pin} ${S.n}`}},v("div",{},v("span",{class:"who",text:P.author}),v("span",{class:"when",text:xt(P.created_at)})),v("div",{class:"body",text:P.comment}),P.comment_url?v("a",{text:n.openReport,attrs:{href:P.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null);T.dataset.pin=P.id,r.append(T),l=T,N(T)},y=S=>{if(m&&l?.dataset.pin===S.item.id){E();return}w(S),m=!0};function E(){l?.remove(),l=null,m=!1}function N(S){let P=S.dataset.pin,T=P?u.get(P):null;if(!T||T.hasAttribute("hidden")){E();return}let L=T.getBoundingClientRect(),I=S.offsetWidth||260,x=S.offsetHeight||120,R=Math.min(Math.max(L.left-I+22,8),window.innerWidth-I-8),_=L.top>x+12?L.top-x-8:L.bottom+8;S.style.left=`${R}px`,S.style.top=`${Math.min(_,window.innerHeight-x-8)}px`}let M=()=>{p&&clearTimeout(p),p=window.setTimeout(()=>{p=0,s&&h()},250)},D=new MutationObserver(M);return D.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class","style","hidden"]}),window.addEventListener("scroll",f,!0),window.addEventListener("resize",f),{update(S,P){i=S,o=P,h()},orphans:()=>c,count:()=>a.length+c.length,setVisible(S){s=S,S||E(),r.toggleAttribute("hidden",!S),S&&h()},isVisible:()=>s,closePopover:E,destroy(){D.disconnect(),window.removeEventListener("scroll",f,!0),window.removeEventListener("resize",f),d&&cancelAnimationFrame(d),p&&clearTimeout(p),E(),r.remove()}}}var Tr=["id","name","type","role","aria-label","title","alt","placeholder","data-testid","data-test","data-cy","data-qa","data-slot","data-key","href"];function Et(e,t){return{tag:e.tagName.toLowerCase(),text:t,xpath:Rr(e),attrs:Pr(e),classes:St(e),ancestors:Ar(e),heading:Nr(e)}}function Pr(e){let t={};for(let n of Tr){let r=e.getAttribute(n)?.trim();r&&ce(n,r)&&(t[n]=A(r,C.attrValue))}return t}function St(e){return(typeof e.className=="string"?e.className:"").trim().split(/\s+/).filter(q).slice(0,C.classes).map(n=>A(n,C.attrValue))}function Rr(e){let t=[],n=e;for(;n&&n.nodeType===1;){let r=n.parentElement,i=n.tagName.toLowerCase();if(!r){t.unshift(i);break}let o=Array.prototype.filter.call(r.children,a=>a.tagName===n?.tagName),s=o.indexOf(n)+1;if(t.unshift(o.length>1?`${i}[${s}]`:i),n=r,t.length>C.pathDepth)return null}return t.length?`/${t.join("/")}`:null}function Ar(e){let t=[],n=e.parentElement;for(;n&&n.tagName!=="HTML"&&t.length<C.ancestors;)t.unshift(Lr(n)),n=n.parentElement;return t}function Nr(e){let t=e;for(;t;){let n=t.previousElementSibling;for(;n;){let r=n.matches("h1,h2,h3,h4,h5,h6")?n:n.querySelector("h1,h2,h3,h4,h5,h6");if(r?.textContent?.trim())return A(r.textContent.replace(/\s+/g," ").trim(),C.elementText);n=n.previousElementSibling}t=t.parentElement}return null}function Lr(e){let t=e.tagName.toLowerCase(),n=e.id?`#${e.id}`:"",r=St(e)[0];return A(`${t}${n}${r?`.${r}`:""}`,C.attrValue)}function Ct(e){let{options:t,storage:n}=e,r=t.labels,i=e.api??Te({path:t.endpoint}),o=Ae(),s=n.readBadge(),a=null,c=null,u=null,l=null,m=null,d=null,p=null,b=null,f=null,h=null,g=0,w=s.corner??t.position,y=s.closed;function E(){if(a)return;a=document.createElement("prevly-feedback");for(let[O,B]of[["position","fixed"],["inset","0"],["z-index","2147483647"],["pointer-events","none"],["display","block"]])a.style.setProperty(O,B,"important");let k=a.attachShadow({mode:"open"}),F=document.createElement("style");F.textContent=st,c=v("div",{class:"root"}),k.append(F,c),M();for(let O of["keydown","keyup","keypress"])a.addEventListener(O,B=>B.stopPropagation());document.body.append(a),u=Le(c,{labels:r,corner:w,topLayer:o,onOpen:()=>T(),onClose:()=>S(),onCorner:O=>{w=O,n.writeBadge({corner:w,closed:y})}}),y||u.surface.show(),l=U(v("div",{class:"overlay"}),o),c.append(l.node),l.show(),p=kt(l.node,a,r),m=U(v("div",{class:"overlay"}),o),c.append(m.node),b=wt(m.node,r),d=U(v("div",{class:"overlay"}),o),c.append(d.node),document.addEventListener("keydown",K,!0),D()}function N(){document.removeEventListener("keydown",K,!0),h?.removeEventListener("change",M),h=null,b?.cancel(),f?.close(),f=null,p?.destroy(),p=null,b=null,u?.destroy(),u=null,l=null,m=null,d=null,g&&clearTimeout(g),c=null,a?.remove(),a=null}function M(){if(!c)return;let k=t.theme;k==="auto"&&(!h&&typeof window.matchMedia=="function"&&(h=window.matchMedia("(prefers-color-scheme: dark)"),h.addEventListener("change",M)),k=h?.matches?"dark":"light"),c.setAttribute("data-theme",k)}async function D(){let k=await i.list();p&&(p.update(k,Ee(location)),u?.setCount(p.count()))}function S(){y=!0,n.writeBadge({corner:w,closed:y}),u?.surface.hide()}function P(){y&&(y=!1,n.writeBadge({corner:w,closed:y}),u?.surface.show())}function T(){f||x(null,null,null)}function L(){!b||!m||(R(),p?.closePopover(),m.show(),b.start(k=>void I(k),()=>m?.hide()))}async function I(k){m?.hide();let F=await j(()=>it(a));x({selector:ht(k.el),element:Et(k.el,ue(k.el)),click:k.click,rect:k.rect},F,k.rect)}function x(k,F,O){c&&(R(),f=ct(c,{labels:r,corner:w,topLayer:o,shot:F,shotFailed:k!==null&&F===null,rect:O,heading:k?`<${k.element.tag}>`:null,author:t.reporter?.name??n.readAuthor(),askAuthor:t.reporter===null,allowPick:k===null,onPick:()=>L(),onCancel:()=>R(),onSubmit:B=>_(B,k)}))}function R(){f?.close(),f=null}async function _(k,F){let O=Fe({type:k.type,author:k.author,comment:k.comment,page:Ee(location),title:document.title,selector:F?.selector??null,element:F?.element??null,click:F?.click??null,rect:F?.rect??null,viewport:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1},userAgent:navigator.userAgent,console:e.recorder.entries(),context:t.context,network:e.network.entries()}),B=Oe(O,r);if(B)return B;let z=await i.submit(O,k.png);return z.ok?(t.reporter===null&&n.writeAuthor(k.author),R(),W(z.item),D(),null):z.kind==="rate-limit"?z.retryAfter?`${r.rateLimited} (${r.retryIn} ${z.retryAfter}s)`:r.rateLimited:z.message||r.sendFailed}async function j(k){a&&a.style.setProperty("display","none","important"),await Mr();try{return await k()}finally{a&&a.style.setProperty("display","block","important")}}function W(k){d&&(g&&clearTimeout(g),d.node.replaceChildren(v("div",{class:"toast",attrs:{role:"status","data-prevly":"toast","data-corner":w}},document.createTextNode(k.comment_url?r.sent:r.sentPending),k.comment_url?v("a",{text:r.openReport,attrs:{href:k.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null)),d.show(),g=window.setTimeout(()=>{d?.hide(),g=0},9e3))}function K(k){if(It(k)){k.preventDefault(),k.stopPropagation(),P(),T();return}if(k.key==="Escape"){if(f)R();else if(b?.isActive())b.cancel();else{p?.closePopover();return}k.preventDefault(),k.stopPropagation()}}function It(k){return k.altKey||k.shiftKey||!k.metaKey&&!k.ctrlKey?!1:k.key.toLowerCase()===t.shortcut}return{mount:E,unmount:N,open(){E(),P(),T()},isMounted:()=>a!==null}}function Mr(){return new Promise(e=>{requestAnimationFrame(()=>requestAnimationFrame(()=>e()))})}function Ir(e){let t=[];for(let n of e)t.push(Dr(n));return t.join(" ")}function Dr(e){if(typeof e=="string")return e;if(e instanceof Error)return`${e.name}: ${e.message}`;if(e===null)return"null";if(e===void 0)return"undefined";if(typeof e=="object")try{return JSON.stringify(e)??String(e)}catch{return Fr(e)}try{return String(e)}catch{return"[unprintable]"}}function Fr(e){let t=e.constructor?.name;return t?`[object ${t}]`:"[object]"}function Tt(e={}){let t=e.limit??C.consoleEntries,n=e.maxMessage??C.consoleMessage,r=e.console??(typeof console<"u"?console:void 0),i=e.target===void 0?typeof window<"u"?window:null:e.target,o=e.now??(()=>new Date),s=[],a=(u,l)=>{try{let m=Ir(l);if(!m)return;for(s.push({level:u,message:m.length<=n?m:m.slice(0,n),at:o().toISOString()});s.length>t;)s.shift()}catch{}},c=[];if(r)for(let u of["error","warn"]){let l=r[u];if(typeof l!="function")continue;let m=function(...p){try{l.apply(this??r,p)}finally{a(u,p)}};r[u]=m,c.push(()=>{r[u]=l})}if(i){let u=m=>{let d=m,p=d.error;!p&&!d.message||a("error",[p instanceof Error?p:d.message])},l=m=>{let d=m.reason;a("error",["Unhandled rejection:",d])};try{i.addEventListener("error",u),i.addEventListener("unhandledrejection",l),c.push(()=>{i.removeEventListener("error",u),i.removeEventListener("unhandledrejection",l)})}catch{}}return{entries:()=>s.slice(),record:a,stop:()=>{for(;c.length;){let u=c.pop();try{u?.()}catch{}}}}}function Pt(e={}){let t=e.limit??C.networkEntries,n=e.target??(typeof window<"u"?window:{}),r=e.base??(typeof location<"u"?location.href:"http://localhost/"),i=e.now??(()=>new Date),o=e.origins?.slice()??[],s=[],a=[],c=(d,p)=>{let b="",f=!1;try{let h=new URL(String(p??""),r);b=h.pathname,f=o.includes(h.origin)}catch{}return{method:(d||"GET").toUpperCase().slice(0,10),path:A(b,C.networkPath),watched:f}},u=(d,p,b)=>{if(!d.watched||p!==0&&p<500)return;let f={method:d.method,path:d.path,status:p,at:i().toISOString()};for(b&&(f.requestId=A(b,C.requestId)),s.push(f);s.length>t;)s.shift()},l=n.fetch;if(typeof l=="function"){let d=async function(b,f){let h=null;try{let g=typeof b=="string"||b instanceof URL?b:b.url,w=f?.method??(typeof b=="object"&&"method"in b?b.method:"GET");h=c(String(w),g)}catch{h=null}try{let g=await l.call(this??n,b,f);if(h){let w=null;try{w=g.headers?.get("x-request-id")??null}catch{}u(h,g.status,w)}return g}catch(g){throw h&&u(h,0,null),g}};n.fetch=d,a.push(()=>{n.fetch=l})}let m=n.XMLHttpRequest;if(typeof m=="function"){let d=m.prototype,p=d.open,b=d.send,f=Symbol("prevly.network");d.open=function(g,w,...y){try{this[f]=c(g,w)}catch{this[f]=null}return p.call(this,g,w,...y)},d.send=function(...g){try{let w=this[f];if(w){let y=E=>{let N=null;try{N=this.getResponseHeader("x-request-id")}catch{}u(w,E,N)};this.addEventListener("load",()=>y(this.status)),this.addEventListener("error",()=>y(0)),this.addEventListener("timeout",()=>y(0)),this.addEventListener("abort",()=>y(0))}}catch{}return b.call(this,...g)},a.push(()=>{d.open=p,d.send=b})}return{entries:()=>s.slice(),origins:()=>o.slice(),setOrigins(d){o=d.slice()},stop(){for(;a.length;){let d=a.pop();try{d?.()}catch{}}}}}var Rt="prevly.feedback.author";function At(){try{return window.localStorage}catch{return null}}function Nt(e,t){let n=`prevly.feedback.badge:${t}`;return{readAuthor(){try{return e?.getItem(Rt)??""}catch{return""}},writeAuthor(r){try{e?.setItem(Rt,r)}catch{}},readBadge(){try{let r=e?.getItem(n);if(!r)return{corner:null,closed:!1};let i=JSON.parse(r);return{corner:fe.includes(i.corner)?i.corner:null,closed:i.closed===!0}}catch{return{corner:null,closed:!1}}},writeBadge(r){try{e?.setItem(n,JSON.stringify({corner:r.corner,closed:r.closed}))}catch{}}}}var Se=null;function Ce(){Se||(Se={console:Tt(),network:Pt()})}function Lt(e){let t={open:()=>{},unmount:()=>{}};try{if(typeof document>"u"||typeof window>"u")return t;let n=De(e);if(!n.endpoint)return t;Ce();let r=Se;r.network.setOrigins(n.origins);let i=Ct({options:n,recorder:r.console,network:r.network,storage:Nt(At(),location.host)});return Or(()=>{try{i.mount()}catch(o){console.debug("[prevly] feedback mount failed",o)}}),{open(){try{i.open()}catch(o){console.debug("[prevly] feedback open failed",o)}},unmount(){try{i.unmount()}catch(o){console.debug("[prevly] feedback unmount failed",o)}}}}catch(n){return console.debug("[prevly] feedback widget failed to start",n),t}}function Or(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}Ce();var Mt=Lt({endpoint:"/_prevly/api/feedback"});window.__prevlyFeedback={open:()=>Mt.open(),hide:()=>Mt.unmount()};})();
