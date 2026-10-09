/* prevly preview feedback widget */
"use strict";(()=>{var Ae="/_prevly/api/feedback";function Pe(e){return typeof e!="string"||!e||!e.startsWith("/")||e.startsWith("//")?Ae:e}var Dt="/_prevly/api/feedback";function Re(e={}){let t=e.path??Dt,n=e.fetchImpl??((...r)=>fetch(...r));return{async list(){try{let r=await n(t,{method:"GET",headers:{accept:"application/json"},credentials:"same-origin"});if(r.status===401)return{items:[],locked:!0};if(!r.ok)return{items:[],locked:!1};let i=await r.json();return{items:Array.isArray(i?.items)?i.items:[],locked:!1}}catch{return{items:[],locked:!1}}},async submit(r,i){let o=new FormData;o.append("meta",new Blob([JSON.stringify(r)],{type:"application/json"}),"meta.json"),i&&o.append("screenshot",i,"screenshot.png");let s;try{s=await n(t,{method:"POST",body:o,credentials:"same-origin"})}catch(a){return{ok:!1,kind:"error",message:_t(a)}}if(s.status===401)return{ok:!1,kind:"locked"};if(s.status===429)return{ok:!1,kind:"rate-limit",retryAfter:Ft(s.headers?.get("retry-after")??null),message:"Too many reports from this preview. Try again in a moment."};if(s.status===201||s.status===200){try{let a=await s.json();if(a?.item)return{ok:!0,item:a.item}}catch{}return{ok:!1,kind:"error",message:"The server returned an unexpected answer."}}return{ok:!1,kind:"error",message:await $t(s)}}}}function Ft(e){if(!e)return null;let t=Number.parseInt(e,10);if(Number.isFinite(t)&&t>=0)return t;let n=Date.parse(e);return Number.isFinite(n)?Math.max(0,Math.round((n-Date.now())/1e3)):null}async function $t(e){try{let t=await e.json(),n=typeof t?.error=="string"?t.error:t?.message;if(typeof n=="string"&&n)return`${e.status} \xB7 ${n}`}catch{}return`Sending failed (HTTP ${e.status}).`}function _t(e){return e instanceof Error&&e.message?e.message:"Network error."}function v(e,t={},...n){let r=document.createElement(e);if(t.class&&(r.className=t.class),t.text!==void 0&&(r.textContent=t.text),t.html!==void 0&&(r.innerHTML=t.html),t.style&&Object.assign(r.style,t.style),t.attrs)for(let[i,o]of Object.entries(t.attrs))r.setAttribute(i,o);if(t.on)for(let[i,o]of Object.entries(t.on))r.addEventListener(i,o);for(let i of n)i==null||i===!1||r.append(i);return r}var fe='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">',Le=`${fe}<path d="M20.5 11.7a8.2 8.2 0 0 1-8.8 8.2 8.8 8.8 0 0 1-3.3-.8L3.5 20.5l1.4-4.6a8.2 8.2 0 0 1-1.4-4.6 8.2 8.2 0 0 1 8.2-8.2 8.2 8.2 0 0 1 8.8 8.6z"/><circle cx="12" cy="11.8" r="1.35" fill="currentColor" stroke="none"/></svg>`,K=`${fe}<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`,Ne=`${fe}<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3.4M12 17.8v3.4M2.8 12h3.4M17.8 12h3.4"/></svg>`;function j(e,t){let n=document.createElement("span");return n.className=t,n.innerHTML=e,n}function Ie(){try{return typeof HTMLElement<"u"&&typeof HTMLElement.prototype.togglePopover=="function"}catch{return!1}}function _(e,t){t?(e.setAttribute("popover","manual"),e.classList.add("top-layer")):e.setAttribute("hidden","");let n=!1,r=()=>{if(!n){if(n=!0,!t){e.removeAttribute("hidden");return}try{e.showPopover()}catch{e.removeAttribute("hidden")}}},i=()=>{if(n){if(n=!1,!t){e.setAttribute("hidden","");return}try{e.hidePopover()}catch{e.setAttribute("hidden","")}}};return{node:e,show:r,hide:i,isShown:()=>n,destroy(){i(),e.remove()}}}var Me=4;function Oe(e,t){let n=v("span",{class:"badge-count",attrs:{hidden:""}}),r=v("button",{class:"badge-button",attrs:{type:"button","aria-label":t.labels.badge,"data-prevly":"badge"}},j(Le,"badge-icon"),n),i=v("button",{class:"badge-close",attrs:{type:"button","aria-label":t.labels.close,"data-prevly":"badge-close"},on:{click:b=>{b.stopPropagation(),t.onClose()}}},j(K,"badge-close-icon")),o=v("div",{class:"badge-wrap",attrs:{"data-corner":t.corner}},r,i);e.appendChild(o);let s=_(o,t.topLayer),a=!1,c=!1,u=-1,l=0,f=0,m=0,d=0,y=b=>{if(b.button!==0)return;let k=o.getBoundingClientRect();u=b.pointerId,a=!0,c=!1,l=b.clientX-k.left,f=b.clientY-k.top,m=b.clientX,d=b.clientY;try{r.setPointerCapture(b.pointerId)}catch{}},p=b=>{!a||b.pointerId!==u||!c&&Math.abs(b.clientX-m)<Me&&Math.abs(b.clientY-d)<Me||(c=!0,o.setAttribute("data-dragging",""),o.style.left=`${b.clientX-l}px`,o.style.top=`${b.clientY-f}px`,o.style.right="auto",o.style.bottom="auto")},g=b=>{if(!a||b.pointerId!==u)return;a=!1,u=-1;try{r.releasePointerCapture(b.pointerId)}catch{}if(!c){t.onOpen();return}let k=o.getBoundingClientRect(),L=qt(k.left+k.width/2,k.top+k.height/2);h(),w(L),t.onCorner(L)};function h(){o.removeAttribute("data-dragging"),o.style.left="",o.style.top="",o.style.right="",o.style.bottom=""}function w(b){o.setAttribute("data-corner",b)}return r.addEventListener("pointerdown",y),r.addEventListener("pointermove",p),r.addEventListener("pointerup",g),r.addEventListener("pointercancel",()=>{a=!1,u=-1,h()}),r.addEventListener("click",b=>b.preventDefault()),{surface:s,setCount(b){n.textContent=String(b),n.toggleAttribute("hidden",b<=0),r.setAttribute("aria-label",b>0?`${t.labels.badge} \xB7 ${b} ${t.labels.reports}`:t.labels.badge)},setCorner:w,destroy(){s.destroy()}}}function qt(e,t){let n=e<window.innerWidth/2;return t<window.innerHeight/2?n?"top-left":"top-right":n?"bottom-left":"bottom-right"}var Ut=[[/Edg\/(\d+)/,"Edge"],[/OPR\/(\d+)/,"Opera"],[/Firefox\/(\d+)/,"Firefox"],[/Chrome\/(\d+)/,"Chrome"],[/Version\/(\d+).*Safari/,"Safari"]],Bt=[[/Windows NT/,"Windows"],[/Android/,"Android"],[/(iPhone|iPad|iPod)/,"iOS"],[/Mac OS X/,"macOS"],[/(Linux|X11)/,"Linux"]];function De(e){let t="";for(let[r,i]of Ut){let o=r.exec(e);if(o){t=`${i} ${o[1]}`;break}}let n="";for(let[r,i]of Bt)if(r.test(e)){n=i;break}return t&&n?`${t} on ${n}`:t||n}var C={author:80,comment:4e3,page:2e3,title:200,selector:500,elementText:120,client:80,attrValue:80,classes:6,ancestors:6,pathDepth:20,consoleEntries:20,consoleMessage:500,networkEntries:5,networkPath:200,requestId:100,contextKeys:10,contextKey:200,contextValue:200};function R(e,t){return e.length<=t?e:e.slice(0,t)}function Q(e){return e.replace(/\s+/g," ").trim()}var ge=["bottom-right","bottom-left","top-right","top-left"],Ht=/^[a-z0-9][a-z0-9-]{0,31}$/;var ie={badge:"Report a problem",close:"Hide",reports:"reports on this page",panel:"New report",comment:"What happened?",commentPlaceholder:"Describe it in one sentence",type:"Type",typeBug:"Bug",typeImprovement:"Improvement",typeQuestion:"Question",name:"Your name",namePlaceholder:"Your name",reportingAs:"Reporting as",changeName:"change",send:"Send",sending:"Sending\u2026",sendHint:"Ctrl/Cmd + Enter",cancel:"Cancel",point:"Point at something",pickerHint:"Click the element to report \xB7 Esc to cancel",undo:"Undo",clear:"Clear",noScreenshot:"The screenshot could not be captured. The report can still be sent without an image.",commentRequired:"A comment is required.",nameRequired:"A name is required.",pageUnknown:"The page is unknown.",sendFailed:"Sending failed.",rateLimited:"Too many reports. Try again in a moment.",retryIn:"retry in",sent:"Sent",sentPending:"Sent, comment pending",openReport:"open",pin:"Report",from:"from",locked:"Open this preview from the link in the pull request to send feedback."},jt={badge:"Signaler un probl\xE8me",close:"Masquer",reports:"signalements sur cette page",panel:"Nouveau signalement",comment:"Que s'est-il pass\xE9 ?",commentPlaceholder:"D\xE9crivez-le en une phrase",type:"Type",typeBug:"Bug",typeImprovement:"Am\xE9lioration",typeQuestion:"Question",name:"Votre nom",namePlaceholder:"Votre nom",reportingAs:"Signal\xE9 en tant que",changeName:"modifier",send:"Envoyer",sending:"Envoi\u2026",sendHint:"Ctrl/Cmd + Entr\xE9e",cancel:"Annuler",point:"Pointer un \xE9l\xE9ment",pickerHint:"Cliquez sur l'\xE9l\xE9ment \xE0 signaler \xB7 \xC9chap pour annuler",undo:"Annuler",clear:"Effacer",noScreenshot:"La capture d'\xE9cran n'a pas pu \xEAtre r\xE9alis\xE9e. Le signalement peut quand m\xEAme \xEAtre envoy\xE9 sans image.",commentRequired:"Un commentaire est requis.",nameRequired:"Un nom est requis.",pageUnknown:"La page est inconnue.",sendFailed:"L'envoi a \xE9chou\xE9.",rateLimited:"Trop de signalements. R\xE9essayez dans un instant.",retryIn:"nouvel essai dans",sent:"Envoy\xE9",sentPending:"Envoy\xE9, commentaire en attente",openReport:"ouvrir",pin:"Signalement",from:"de",locked:"Ouvrez cet aper\xE7u depuis le lien de la pull request pour envoyer un signalement."},Wt={en:ie,fr:jt};function zt(e){let t=(e??"").toLowerCase();return t==="fr"||t.startsWith("fr-")?"fr":"en"}var me={keys:10,key:200,value:200};function Fe(e){let t=typeof document<"u"?document.documentElement.lang:void 0,r={...Wt[zt(t)]??ie,...Gt(e?.labels)};return{endpoint:typeof e?.endpoint=="string"?e.endpoint:"",reporter:Xt(e?.reporter),context:Yt(e?.context),labels:r,position:ge.includes(e?.position)?e.position:"bottom-right",origins:Qt(e?.network?.origins),requestIdHeader:Kt(e?.network?.requestIdHeader),theme:e?.theme==="auto"||e?.theme==="dark"?e.theme:"light",types:Vt(e?.types,r)}}function oe(e){return[{id:"bug",label:e.typeBug},{id:"improvement",label:e.typeImprovement},{id:"question",label:e.typeQuestion}]}function Vt(e,t){if(!Array.isArray(e)||e.length===0||e.length>8)return oe(t);let n=new Set,r=[];for(let i of e){let o=i?.id,s=i?.label;if(typeof o!="string"||!Ht.test(o)||typeof s!="string"||!s||n.has(o))return oe(t);n.add(o),r.push({id:o,label:s})}return r}function Xt(e){let t=typeof e?.name=="string"?e.name.trim():"";return t?{name:t}:null}function Yt(e){if(!e||typeof e!="object")return{};let t={};for(let[n,r]of Object.entries(e)){if(Object.keys(t).length>=me.keys)break;!n||r===null||r===void 0||(t[n.slice(0,me.key)]=String(r).slice(0,me.value))}return t}function Gt(e){if(!e||typeof e!="object")return{};let t={};for(let[n,r]of Object.entries(e))typeof r=="string"&&r&&(t[n]=r);return t}function Kt(e){return(typeof e=="string"?e.trim():"")||"x-request-id"}function Qt(e){let t=typeof location<"u"?location.origin:"";if(!Array.isArray(e)||e.length===0)return t?[t]:[];let n=[];for(let r of e)if(!(typeof r!="string"||!r))try{n.push(new URL(r,t||void 0).origin)}catch{}return n}function $e(e){let t={type:e.type,author:R(Q(e.author),C.author),comment:R(e.comment.trim(),C.comment),page:R(e.page,C.page),viewport:{w:Math.round(e.viewport.w),h:Math.round(e.viewport.h),dpr:tn(e.viewport.dpr)},client:R(De(e.userAgent??""),C.client),console:en(e.console??[])},n=Q(e.title??"");n&&(t.title=R(n,C.title));let r=(e.selector??"").trim();if(r&&(t.selector=R(r,C.selector)),e.element){let s=e.element,a={tag:s.tag.toLowerCase(),text:R(Q(s.text),C.elementText)};s.xpath&&(a.xpath=R(s.xpath,C.selector)),s.attrs&&Object.keys(s.attrs).length&&(a.attrs=s.attrs),s.classes?.length&&(a.classes=s.classes),s.ancestors?.length&&(a.ancestors=s.ancestors),s.heading&&(a.heading=R(Q(s.heading),C.elementText)),t.element=a}e.click&&(t.click={x:Math.round(e.click.x),y:Math.round(e.click.y)});let i=Jt(e.context??{});Object.keys(i).length&&(t.context=i);let o=Zt(e.network??[]);return o.length&&(t.network=o),e.rect&&(t.rect={x:Math.round(e.rect.x),y:Math.round(e.rect.y),w:Math.round(e.rect.w),h:Math.round(e.rect.h)}),t}function _e(e,t=ie){return e.author?e.comment?e.page?null:t.pageUnknown:t.commentRequired:t.nameRequired}function Jt(e){let t={};for(let[n,r]of Object.entries(e)){if(Object.keys(t).length>=C.contextKeys)break;n&&(t[R(n,C.contextKey)]=R(String(r),C.contextValue))}return t}function Zt(e){return e.slice(-C.networkEntries).map(t=>{let n={method:t.method,path:R(t.path,C.networkPath),status:t.status,at:t.at};return t.requestId&&(n.requestId=R(t.requestId,C.requestId)),n})}function en(e){return e.slice(-C.consoleEntries).map(n=>({level:n.level,message:R(n.message,C.consoleMessage),at:n.at}))}function tn(e){return Math.round(e*100)/100}var ze="[modern-screenshot]",B=typeof window<"u",nn=B&&"Worker"in window,so=B&&"atob"in window,lo=B&&"btoa"in window,ye=B?window.navigator?.userAgent:"",Ve=ye.includes("Chrome"),ae=ye.includes("AppleWebKit")&&!Ve,we=ye.includes("Firefox"),rn=e=>e&&"__CONTEXT__"in e,on=e=>e.constructor.name==="CSSFontFaceRule",an=e=>e.constructor.name==="CSSImportRule",sn=e=>e.constructor.name==="CSSLayerBlockRule",$=e=>e.nodeType===1,te=e=>typeof e.className=="object",Xe=e=>e.tagName==="image",ln=e=>e.tagName==="use",J=e=>$(e)&&typeof e.style<"u"&&!te(e),cn=e=>e.nodeType===8,un=e=>e.nodeType===3,Y=e=>e.tagName==="IMG",se=e=>e.tagName==="VIDEO",dn=e=>e.tagName==="CANVAS",pn=e=>e.tagName==="TEXTAREA",fn=e=>e.tagName==="INPUT",mn=e=>e.tagName==="STYLE",gn=e=>e.tagName==="SCRIPT",hn=e=>e.tagName==="SELECT",bn=e=>e.tagName==="SLOT",yn=e=>e.tagName==="IFRAME",wn=(...e)=>console.warn(ze,...e);function vn(e){let t=e?.createElement?.("canvas");return t&&(t.height=t.width=1),!!t&&"toDataURL"in t&&!!t.toDataURL("image/webp").includes("image/webp")}var he=e=>e.startsWith("data:");function Ye(e,t){if(e.match(/^[a-z]+:\/\//i))return e;if(B&&e.match(/^\/\//))return window.location.protocol+e;if(e.match(/^[a-z]+:/i)||!B)return e;let n=le().implementation.createHTMLDocument(),r=n.createElement("base"),i=n.createElement("a");return n.head.appendChild(r),n.body.appendChild(i),t&&(r.href=t),i.href=e,i.href}function le(e){return(e&&$(e)?e?.ownerDocument:e)??window.document}var ce="http://www.w3.org/2000/svg";function xn(e,t,n){let r=le(n).createElementNS(ce,"svg");return r.setAttributeNS(null,"width",e.toString()),r.setAttributeNS(null,"height",t.toString()),r.setAttributeNS(null,"viewBox",`0 0 ${e} ${t}`),r}function kn(e,t){let n=new XMLSerializer().serializeToString(e);return t&&(n=n.replace(/[\u0000-\u0008\v\f\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu,"")),`data:image/svg+xml;charset=utf-8,${encodeURIComponent(n)}`}function En(e,t){return new Promise((n,r)=>{let i=new FileReader;i.onload=()=>n(i.result),i.onerror=()=>r(i.error),i.onabort=()=>r(new Error(`Failed read blob to ${t}`)),t==="dataUrl"?i.readAsDataURL(e):t==="arrayBuffer"&&i.readAsArrayBuffer(e)})}var Sn=e=>En(e,"dataUrl");function X(e,t){let n=le(t).createElement("img");return n.decoding="sync",n.loading="eager",n.src=e,n}function Z(e,t){return new Promise(n=>{let{timeout:r,ownerDocument:i,onError:o,onWarn:s}=t??{},a=typeof e=="string"?X(e,le(i)):e,c=null,u=null;function l(){n(a),c&&clearTimeout(c),u?.()}if(r&&(c=setTimeout(l,r)),se(a)){let f=a.currentSrc||a.src;if(!f)return a.poster?Z(a.poster,t).then(n):l();if(a.readyState>=2)return l();let m=l,d=y=>{s?.("Failed video load",f,y),o?.(y),l()};u=()=>{a.removeEventListener("loadeddata",m),a.removeEventListener("error",d)},a.addEventListener("loadeddata",m,{once:!0}),a.addEventListener("error",d,{once:!0})}else{let f=Xe(a)?a.href.baseVal:a.currentSrc||a.src;if(!f)return l();let m=async()=>{if(Y(a)&&"decode"in a)try{await a.decode()}catch(y){s?.("Failed to decode image, trying to render anyway",a.dataset.originalSrc||f,y)}l()},d=y=>{s?.("Failed image load",a.dataset.originalSrc||f,y),l()};if(Y(a)&&a.complete)return m();u=()=>{a.removeEventListener("load",m),a.removeEventListener("error",d)},a.addEventListener("load",m,{once:!0}),a.addEventListener("error",d,{once:!0})}})}async function Cn(e,t){J(e)&&(Y(e)||se(e)?await Z(e,t):await Promise.all(["img","video"].flatMap(n=>Array.from(e.querySelectorAll(n)).map(r=>Z(r,t)))))}var Ge=(function(){let t=0,n=()=>`0000${(Math.random()*36**4<<0).toString(36)}`.slice(-4);return()=>(t+=1,`u${n()}${t}`)})();function Ke(e){return e?.split(",").map(t=>t.trim().replace(/"|'/g,"").toLowerCase()).filter(Boolean)}var qe=0;function Tn(e){let t=`${ze}[#${qe}]`;return qe++,{time:n=>e&&console.time(`${t} ${n}`),timeEnd:n=>e&&console.timeEnd(`${t} ${n}`),warn:(...n)=>e&&wn(...n)}}function An(e){return{cache:e?"no-cache":"force-cache"}}async function Qe(e,t){return rn(e)?e:Pn(e,{...t,autoDestruct:!0})}async function Pn(e,t){let{scale:n=1,workerUrl:r,workerNumber:i=1}=t||{},o=!!t?.debug,s=t?.features??!0,a=e.ownerDocument??(B?window.document:void 0),c=e.ownerDocument?.defaultView??(B?window:void 0),u=new Map,l={width:0,height:0,quality:1,type:"image/png",scale:n,backgroundColor:null,style:null,filter:null,maximumCanvasSize:0,timeout:3e4,progress:null,debug:o,fetch:{requestInit:An(t?.fetch?.bypassingCache),placeholderImage:"data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",bypassingCache:!1,...t?.fetch},fetchFn:null,font:{},drawImageInterval:100,workerUrl:null,workerNumber:i,onCloneEachNode:null,onCloneNode:null,onEmbedNode:null,onCreateForeignObjectSvg:null,includeStyleProperties:null,autoDestruct:!1,...t,__CONTEXT__:!0,log:Tn(o),node:e,ownerDocument:a,ownerWindow:c,dpi:n===1?null:96*n,svgStyleElement:Je(a),svgDefsElement:a?.createElementNS(ce,"defs"),svgStyles:new Map,defaultComputedStyles:new Map,workers:[...Array.from({length:nn&&r&&i?i:0})].map(()=>{try{let d=new Worker(r);return d.onmessage=async y=>{let{url:p,result:g}=y.data;g?u.get(p)?.resolve?.(g):u.get(p)?.reject?.(new Error(`Error receiving message from worker: ${p}`))},d.onmessageerror=y=>{let{url:p}=y.data;u.get(p)?.reject?.(new Error(`Error receiving message from worker: ${p}`))},d}catch(d){return l.log.warn("Failed to new Worker",d),null}}).filter(Boolean),fontFamilies:new Map,fontCssTexts:new Map,acceptOfImage:`${[vn(a)&&"image/webp","image/svg+xml","image/*","*/*"].filter(Boolean).join(",")};q=0.8`,requests:u,drawImageCount:0,tasks:[],features:s,isEnable:d=>d==="restoreScrollPosition"?typeof s=="boolean"?!1:s[d]??!1:typeof s=="boolean"?s:s[d]??!0,shadowRoots:[]};l.log.time("wait until load"),await Cn(e,{timeout:l.timeout,onWarn:l.log.warn}),l.log.timeEnd("wait until load");let{width:f,height:m}=Rn(e,l);return l.width=f,l.height=m,l}function Je(e){if(!e)return;let t=e.createElement("style"),n=t.ownerDocument.createTextNode(`
.______background-clip--text {
  background-clip: text;
  -webkit-background-clip: text;
}
`);return t.appendChild(n),t}function Rn(e,t){let{width:n,height:r}=t;if($(e)&&(!n||!r)){let i=e.getBoundingClientRect();n=n||i.width||Number(e.getAttribute("width"))||0,r=r||i.height||Number(e.getAttribute("height"))||0}return{width:n,height:r}}async function Ln(e,t){let{log:n,timeout:r,drawImageCount:i,drawImageInterval:o}=t;n.time("image to canvas");let s=await Z(e,{timeout:r,onWarn:t.log.warn}),{canvas:a,context2d:c}=Nn(e.ownerDocument,t),u=()=>{try{c?.drawImage(s,0,0,a.width,a.height)}catch(l){t.log.warn("Failed to drawImage",l)}};if(u(),t.isEnable("fixSvgXmlDecode"))for(let l=0;l<i;l++)await new Promise(f=>{setTimeout(()=>{c?.clearRect(0,0,a.width,a.height),u(),f()},l+o)});return t.drawImageCount=0,n.timeEnd("image to canvas"),a}function Nn(e,t){let{width:n,height:r,scale:i,backgroundColor:o,maximumCanvasSize:s}=t,a=e.createElement("canvas");a.width=Math.floor(n*i),a.height=Math.floor(r*i),a.style.width=`${n}px`,a.style.height=`${r}px`,s&&(a.width>s||a.height>s)&&(a.width>s&&a.height>s?a.width>a.height?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s):a.width>s?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s));let c=a.getContext("2d");return c&&o&&(c.fillStyle=o,c.fillRect(0,0,a.width,a.height)),{canvas:a,context2d:c}}function Ze(e,t){if(e.ownerDocument)try{let o=e.toDataURL();if(o!=="data:,")return X(o,e.ownerDocument)}catch(o){t.log.warn("Failed to clone canvas",o)}let n=e.cloneNode(!1),r=e.getContext("2d"),i=n.getContext("2d");try{return r&&i&&i.putImageData(r.getImageData(0,0,e.width,e.height),0,0),n}catch(o){t.log.warn("Failed to clone canvas",o)}return n}function In(e,t){try{if(e?.contentDocument?.documentElement)return ve(e.contentDocument.documentElement,t)}catch(n){t.log.warn("Failed to clone iframe",n)}return e.cloneNode(!1)}function Mn(e){let t=e.cloneNode(!1);return e.currentSrc&&e.currentSrc!==e.src&&(t.src=e.currentSrc,t.srcset=""),t.loading==="lazy"&&(t.loading="eager"),t}async function On(e,t){if(e.ownerDocument&&!e.currentSrc&&e.poster)return X(e.poster,e.ownerDocument);let n=e.cloneNode(!1);n.crossOrigin="anonymous",e.currentSrc&&e.currentSrc!==e.src&&(n.src=e.currentSrc);let r=n.ownerDocument;if(r){let i=!0;if(await Z(n,{onError:()=>i=!1,onWarn:t.log.warn}),!i)return e.poster?X(e.poster,e.ownerDocument):n;n.currentTime=e.currentTime,await new Promise(s=>{n.addEventListener("seeked",s,{once:!0})});let o=r.createElement("canvas");o.width=e.offsetWidth,o.height=e.offsetHeight;try{let s=o.getContext("2d");s&&s.drawImage(n,0,0,o.width,o.height)}catch(s){return t.log.warn("Failed to clone video",s),e.poster?X(e.poster,e.ownerDocument):n}return Ze(o,t)}return n}function Dn(e,t){return dn(e)?Ze(e,t):yn(e)?In(e,t):Y(e)?Mn(e):se(e)?On(e,t):e.cloneNode(!1)}function Fn(e){let t=e.sandbox;if(!t){let{ownerDocument:n}=e;try{n&&(t=n.createElement("iframe"),t.id=`__SANDBOX__${Ge()}`,t.width="0",t.height="0",t.style.visibility="hidden",t.style.position="fixed",n.body.appendChild(t),t.srcdoc='<!DOCTYPE html><meta charset="UTF-8"><title></title><body>',e.sandbox=t)}catch(r){e.log.warn("Failed to getSandBox",r)}}return t}var $n=["width","height","-webkit-text-fill-color"],_n=["stroke","fill"];function et(e,t,n){let{defaultComputedStyles:r}=n,i=e.nodeName.toLowerCase(),o=te(e)&&i!=="svg",s=o?_n.map(p=>[p,e.getAttribute(p)]).filter(([,p])=>p!==null):[],a=[o&&"svg",i,s.map((p,g)=>`${p}=${g}`).join(","),t].filter(Boolean).join(":");if(r.has(a))return r.get(a);let u=Fn(n)?.contentWindow;if(!u)return new Map;let l=u?.document,f,m;o?(f=l.createElementNS(ce,"svg"),m=f.ownerDocument.createElementNS(f.namespaceURI,i),s.forEach(([p,g])=>{m.setAttributeNS(null,p,g)}),f.appendChild(m)):f=m=l.createElement(i),m.textContent=" ",l.body.appendChild(f);let d=u.getComputedStyle(m,t),y=new Map;for(let p=d.length,g=0;g<p;g++){let h=d.item(g);$n.includes(h)||y.set(h,d.getPropertyValue(h))}return l.body.removeChild(f),r.set(a,y),y}function tt(e,t,n){let r=new Map,i=[],o=new Map;if(n)for(let a of n)s(a);else for(let a=e.length,c=0;c<a;c++){let u=e.item(c);s(u)}for(let a=i.length,c=0;c<a;c++)o.get(i[c])?.forEach((u,l)=>r.set(l,u));function s(a){let c=e.getPropertyValue(a),u=e.getPropertyPriority(a),l=a.lastIndexOf("-"),f=l>-1?a.substring(0,l):void 0;if(f){let m=o.get(f);m||(m=new Map,o.set(f,m)),m.set(a,[c,u])}t.get(a)===c&&!u||(f?i.push(f):r.set(a,[c,u]))}return r}function qn(e,t,n,r){let{ownerWindow:i,includeStyleProperties:o,currentParentNodeStyle:s}=r,a=t.style,c=i.getComputedStyle(e),u=et(e,null,r);s?.forEach((f,m)=>{u.delete(m)});let l=tt(c,u,o);l.delete("transition-property"),l.delete("all"),l.delete("d"),l.delete("content"),n&&(l.delete("position"),l.delete("margin-top"),l.delete("margin-right"),l.delete("margin-bottom"),l.delete("margin-left"),l.delete("margin-block-start"),l.delete("margin-block-end"),l.delete("margin-inline-start"),l.delete("margin-inline-end"),l.set("box-sizing",["border-box",""])),l.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text"),Ve&&(l.has("font-kerning")||l.set("font-kerning",["normal",""]),(l.get("overflow-x")?.[0]==="hidden"||l.get("overflow-y")?.[0]==="hidden")&&l.get("text-overflow")?.[0]==="ellipsis"&&e.scrollWidth===e.clientWidth&&l.set("text-overflow",["clip",""]));for(let f=a.length,m=0;m<f;m++)a.removeProperty(a.item(m));return l.forEach(([f,m],d)=>{a.setProperty(d,f,m)}),l}function Un(e,t){(pn(e)||fn(e)||hn(e))&&t.setAttribute("value",e.value)}var Bn=["::before","::after"],Hn=["::-webkit-scrollbar","::-webkit-scrollbar-button","::-webkit-scrollbar-thumb","::-webkit-scrollbar-track","::-webkit-scrollbar-track-piece","::-webkit-scrollbar-corner","::-webkit-resizer"];function jn(e,t,n,r,i){let{ownerWindow:o,svgStyleElement:s,svgStyles:a,currentNodeStyle:c}=r;if(!s||!o)return;function u(l){let f=o.getComputedStyle(e,l),m=f.getPropertyValue("content");if(!m||m==="none")return;i?.(m),m=m.replace(/(')|(")|(counter\(.+\))/g,"");let d=[Ge()],y=et(e,l,r);c?.forEach((b,k)=>{y.delete(k)});let p=tt(f,y,r.includeStyleProperties);p.delete("content"),p.delete("-webkit-locale"),p.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text");let g=[`content: '${m}';`];if(p.forEach(([b,k],L)=>{g.push(`${L}: ${b}${k?" !important":""};`)}),g.length===1)return;try{t.className=[t.className,...d].join(" ")}catch(b){r.log.warn("Failed to copyPseudoClass",b);return}let h=g.join(`
  `),w=a.get(h);w||(w=[],a.set(h,w)),w.push(`.${d[0]}${l}`)}Bn.forEach(u),n&&Hn.forEach(u)}var Ue=new Set(["symbol"]);async function Be(e,t,n,r,i){if($(n)&&(mn(n)||gn(n))||r.filter&&!r.filter(n))return;Ue.has(t.nodeName)||Ue.has(n.nodeName)?r.currentParentNodeStyle=void 0:r.currentParentNodeStyle=r.currentNodeStyle;let o=await ve(n,r,!1,i);r.isEnable("restoreScrollPosition")&&Wn(e,o),t.appendChild(o)}async function He(e,t,n,r){let i=e.firstChild;$(e)&&e.shadowRoot&&(i=e.shadowRoot?.firstChild,n.shadowRoots.push(e.shadowRoot));for(let o=i;o;o=o.nextSibling)if(!cn(o))if($(o)&&bn(o)&&typeof o.assignedNodes=="function"){let s=o.assignedNodes();for(let a=0;a<s.length;a++)await Be(e,t,s[a],n,r)}else await Be(e,t,o,n,r)}function Wn(e,t){if(!J(e)||!J(t))return;let{scrollTop:n,scrollLeft:r}=e;if(!n&&!r)return;let{transform:i}=t.style,o=new DOMMatrix(i),{a:s,b:a,c,d:u}=o;o.a=1,o.b=0,o.c=0,o.d=1,o.translateSelf(-r,-n),o.a=s,o.b=a,o.c=c,o.d=u,t.style.transform=o.toString()}function zn(e,t){let{backgroundColor:n,width:r,height:i,style:o}=t,s=e.style;if(n&&s.setProperty("background-color",n,"important"),r&&s.setProperty("width",`${r}px`,"important"),i&&s.setProperty("height",`${i}px`,"important"),o)for(let a in o)s[a]=o[a]}var Vn=/^[\w-:]+$/;async function ve(e,t,n=!1,r){let{ownerDocument:i,ownerWindow:o,fontFamilies:s,onCloneEachNode:a}=t;if(i&&un(e))return r&&/\S/.test(e.data)&&r(e.data),i.createTextNode(e.data);if(i&&o&&$(e)&&(J(e)||te(e))){let u=await Dn(e,t);if(t.isEnable("removeAbnormalAttributes")){let p=u.getAttributeNames();for(let g=p.length,h=0;h<g;h++){let w=p[h];Vn.test(w)||u.removeAttribute(w)}}let l=t.currentNodeStyle=qn(e,u,n,t);n&&zn(u,t);let f=!1;if(t.isEnable("copyScrollbar")){let p=[l.get("overflow-x")?.[0],l.get("overflow-y")?.[0]];f=p.includes("scroll")||(p.includes("auto")||p.includes("overlay"))&&(e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth)}let m=l.get("text-transform")?.[0],d=Ke(l.get("font-family")?.[0]),y=d?p=>{m==="uppercase"?p=p.toUpperCase():m==="lowercase"?p=p.toLowerCase():m==="capitalize"&&(p=p[0].toUpperCase()+p.substring(1)),d.forEach(g=>{let h=s.get(g);h||s.set(g,h=new Set),p.split("").forEach(w=>h.add(w))})}:void 0;return jn(e,u,f,t,y),Un(e,u),se(e)||await He(e,u,t,y),await a?.(u),u}let c=e.cloneNode(!1);return await He(e,c,t),await a?.(c),c}function Xn(e){if(e.ownerDocument=void 0,e.ownerWindow=void 0,e.svgStyleElement=void 0,e.svgDefsElement=void 0,e.svgStyles.clear(),e.defaultComputedStyles.clear(),e.sandbox){try{e.sandbox.remove()}catch(t){e.log.warn("Failed to destroyContext",t)}e.sandbox=void 0}e.workers=[],e.fontFamilies.clear(),e.fontCssTexts.clear(),e.requests.clear(),e.tasks=[],e.shadowRoots=[]}function Yn(e){let{url:t,timeout:n,responseType:r,...i}=e,o=new AbortController,s=n?setTimeout(()=>o.abort(),n):void 0;return fetch(t,{signal:o.signal,...i}).then(a=>{if(!a.ok)throw new Error("Failed fetch, not 2xx response",{cause:a});switch(r){case"arrayBuffer":return a.arrayBuffer();case"dataUrl":return a.blob().then(Sn);case"text":default:return a.text()}}).finally(()=>clearTimeout(s))}function ee(e,t){let{url:n,requestType:r="text",responseType:i="text",imageDom:o}=t,s=n,{timeout:a,acceptOfImage:c,requests:u,fetchFn:l,fetch:{requestInit:f,bypassingCache:m,placeholderImage:d},font:y,workers:p,fontFamilies:g}=e;r==="image"&&(ae||we)&&e.drawImageCount++;let h=u.get(n);if(!h){m&&m instanceof RegExp&&m.test(s)&&(s+=(/\?/.test(s)?"&":"?")+new Date().getTime());let w=r.startsWith("font")&&y&&y.minify,b=new Set;w&&r.split(";")[1].split(",").forEach(O=>{g.has(O)&&g.get(O).forEach(E=>b.add(E))});let k=w&&b.size,L={url:s,timeout:a,responseType:k?"arrayBuffer":i,headers:r==="image"?{accept:c}:void 0,...f};h={type:r,resolve:void 0,reject:void 0,response:null},h.response=(async()=>{if(l&&r==="image"){let N=await l(n);if(N)return N}return!ae&&n.startsWith("http")&&p.length?new Promise((N,O)=>{p[u.size&p.length-1].postMessage({rawUrl:n,...L}),h.resolve=N,h.reject=O}):Yn(L)})().catch(N=>{if(u.delete(n),r==="image"&&d)return e.log.warn("Failed to fetch image base64, trying to use placeholder image",s),typeof d=="string"?d:d(o);throw N}),u.set(n,h)}return h.response}async function nt(e,t,n,r){if(!rt(e))return e;for(let[i,o]of Gn(e,t))try{let s=await ee(n,{url:o,requestType:r?"image":"text",responseType:"dataUrl"});e=e.replace(Kn(i),`$1${s}$3`)}catch(s){n.log.warn("Failed to fetch css data url",i,s)}return e}function rt(e){return/url\((['"]?)([^'"]+?)\1\)/.test(e)}var ot=/url\((['"]?)([^'"]+?)\1\)/g;function Gn(e,t){let n=[];return e.replace(ot,(r,i,o)=>(n.push([o,Ye(o,t)]),r)),n.filter(([r])=>!he(r))}function Kn(e){let t=e.replace(/([.*+?^${}()|\[\]\/\\])/g,"\\$1");return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`,"g")}var Qn=["background-image","border-image-source","-webkit-border-image","-webkit-mask-image","list-style-image"];function Jn(e,t){return Qn.map(n=>{let r=e.getPropertyValue(n);return!r||r==="none"?null:((ae||we)&&t.drawImageCount++,nt(r,null,t,!0).then(i=>{!i||r===i||e.setProperty(n,i,e.getPropertyPriority(n))}))}).filter(Boolean)}function Zn(e,t){if(Y(e)){let n=e.currentSrc||e.src;if(!he(n))return[ee(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.srcset="",e.dataset.originalSrc=n,e.src=r||"")})];(ae||we)&&t.drawImageCount++}else if(te(e)&&!he(e.href.baseVal)){let n=e.href.baseVal;return[ee(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.dataset.originalSrc=n,e.href.baseVal=r||"")})]}return[]}function er(e,t){let{ownerDocument:n,svgDefsElement:r}=t,i=e.getAttribute("href")??e.getAttribute("xlink:href");if(!i)return[];let[o,s]=i.split("#");if(s){let a=`#${s}`,c=t.shadowRoots.reduce((u,l)=>u??l.querySelector(`svg ${a}`),n?.querySelector(`svg ${a}`));if(o&&e.setAttribute("href",a),r?.querySelector(a))return[];if(c)return r?.appendChild(c.cloneNode(!0)),[];if(o)return[ee(t,{url:o,responseType:"text"}).then(u=>{r?.insertAdjacentHTML("beforeend",u)})]}return[]}function it(e,t){let{tasks:n}=t;$(e)&&((Y(e)||Xe(e))&&n.push(...Zn(e,t)),ln(e)&&n.push(...er(e,t))),J(e)&&n.push(...Jn(e.style,t)),e.childNodes.forEach(r=>{it(r,t)})}async function tr(e,t){let{ownerDocument:n,svgStyleElement:r,fontFamilies:i,fontCssTexts:o,tasks:s,font:a}=t;if(!(!n||!r||!i.size))if(a&&a.cssText){let c=We(a.cssText,t);r.appendChild(n.createTextNode(`${c}
`))}else{let c=Array.from(n.styleSheets).filter(d=>{try{return"cssRules"in d&&!!d.cssRules.length}catch(y){return t.log.warn(`Error while reading CSS rules from ${d.href}`,y),!1}}),u=n.implementation.createHTMLDocument(""),l=u.createElement("style");u.head.appendChild(l);let f=l.sheet;await Promise.all(c.flatMap(d=>Array.from(d.cssRules).map(async y=>{if(an(y)){let p=y.href,g="";try{g=await ee(t,{url:p,requestType:"text",responseType:"text"})}catch(w){t.log.warn(`Error fetch remote css import from ${p}`,w)}let h=g.replace(ot,(w,b,k)=>w.replace(k,Ye(k,p)));for(let w of rr(h))try{f.insertRule(w,f.cssRules.length)}catch(b){t.log.warn("Error inserting rule from remote css import",{rule:w,error:b})}}}))),f.cssRules.length&&c.push(f);let m=[];c.forEach(d=>{be(d.cssRules,m)}),m.filter(d=>on(d)&&rt(d.style.getPropertyValue("src"))&&Ke(d.style.getPropertyValue("font-family"))?.some(y=>i.has(y))).forEach(d=>{let y=d,p=o.get(y.cssText);p?r.appendChild(n.createTextNode(`${p}
`)):s.push(nt(y.cssText,y.parentStyleSheet?y.parentStyleSheet.href:null,t).then(g=>{g=We(g,t),o.set(y.cssText,g),r.appendChild(n.createTextNode(`${g}
`))}))})}}var nr=/(\/\*[\s\S]*?\*\/)/g,je=/((@.*?keyframes [\s\S]*?){([\s\S]*?}\s*?)})/gi;function rr(e){if(e==null)return[];let t=[],n=e.replace(nr,"");for(;;){let o=je.exec(n);if(!o)break;t.push(o[0])}n=n.replace(je,"");let r=/@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi,i=new RegExp("((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})","gi");for(;;){let o=r.exec(n);if(o)i.lastIndex=r.lastIndex;else if(o=i.exec(n),o)r.lastIndex=i.lastIndex;else break;t.push(o[0])}return t}var or=/url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g,ir=/src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;function We(e,t){let{font:n}=t,r=n?n?.preferredFormat:void 0;return r?e.replace(ir,i=>{for(;;){let[o,,s]=or.exec(i)||[];if(!s)return"";if(s===r)return`src: ${o};`}}):e}function be(e,t=[]){for(let n of Array.from(e))sn(n)?t.push(...be(n.cssRules)):"cssRules"in n?be(n.cssRules,t):t.push(n);return t}var ar=/\bx?link:?href\s*=\s*["'](?!data:)[^"']+["']/i;function sr(e){return ar.test(e.innerHTML)}async function lr(e,t){let n=await Qe(e,t);if($(n.node)&&te(n.node)&&!sr(n.node))return n.node;let{ownerDocument:r,log:i,tasks:o,svgStyleElement:s,svgDefsElement:a,svgStyles:c,font:u,progress:l,autoDestruct:f,onCloneNode:m,onEmbedNode:d,onCreateForeignObjectSvg:y}=n;i.time("clone node");let p=await ve(n.node,n,!0);if(s&&r){let k="";c.forEach((L,N)=>{k+=`${L.join(`,
`)} {
  ${N}
}
`}),s.appendChild(r.createTextNode(k))}i.timeEnd("clone node"),await m?.(p),u!==!1&&$(p)&&(i.time("embed web font"),await tr(p,n),i.timeEnd("embed web font")),i.time("embed node"),it(p,n);let g=o.length,h=0,w=async()=>{for(;;){let k=o.pop();if(!k)break;try{await k}catch(L){n.log.warn("Failed to run task",L)}l?.(++h,g)}};l?.(h,g),await Promise.all([...Array.from({length:4})].map(w)),i.timeEnd("embed node"),await d?.(p);let b=cr(p,n);return a&&b.insertBefore(a,b.children[0]),s&&b.insertBefore(s,b.children[0]),f&&Xn(n),await y?.(b),b}function cr(e,t){let{width:n,height:r}=t,i=xn(n,r,e.ownerDocument),o=i.ownerDocument.createElementNS(i.namespaceURI,"foreignObject");return o.setAttributeNS(null,"x","0%"),o.setAttributeNS(null,"y","0%"),o.setAttributeNS(null,"width","100%"),o.setAttributeNS(null,"height","100%"),o.append(e),i.appendChild(o),i}async function at(e,t){let n=await Qe(e,t),r=await lr(n),i=kn(r,n.isEnable("removeControlCharacter"));n.autoDestruct||(n.svgStyleElement=Je(n.ownerDocument),n.svgDefsElement=n.ownerDocument?.createElementNS(ce,"defs"),n.svgStyles.clear());let o=X(i,r.ownerDocument);return await Ln(o,n)}var ur=2;function dr(e){let t=Number.isFinite(e)&&e>0?e:1;return Math.min(t,ur)}async function st(e){try{let t=dr(window.devicePixelRatio),n=await at(document.documentElement,{scale:t,backgroundColor:pr(),timeout:15e3,filter:u=>!(e&&(u===e||e.contains(u)))}),r=Math.max(1,Math.round(window.innerWidth*t)),i=Math.max(1,Math.round(window.innerHeight*t)),o=document.createElement("canvas");o.width=r,o.height=i;let s=o.getContext("2d");if(!s)return null;let a=Math.round(window.scrollX*t),c=Math.round(window.scrollY*t);return s.drawImage(n,a,c,r,i,0,0,r,i),{canvas:o,width:r,height:i,scale:t}}catch(t){return console.debug("[prevly] screenshot failed",t),null}}function lt(e){return new Promise(t=>{try{e.toBlob(n=>t(n),"image/png")}catch{t(null)}})}function pr(){try{let e=getComputedStyle(document.body).backgroundColor;if(e&&e!=="rgba(0, 0, 0, 0)"&&e!=="transparent")return e;let t=getComputedStyle(document.documentElement).backgroundColor;if(t&&t!=="rgba(0, 0, 0, 0)"&&t!=="transparent")return t}catch{}return"#ffffff"}var ue="#e11d48",ct=`
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
  --accent: ${ue};
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
`;function dt(e,t){if(t.locked)return fr(e,t);let{labels:n,shot:r}=t,i=[],o=null,s=!1,a=t.types[0]?.id??"bug",c=v("canvas"),u=r?Math.max(2,Math.round(3*r.scale)):3;r&&(c.width=r.width,c.height=r.height);let l=x=>{if(r){if(x.clearRect(0,0,r.width,r.height),x.drawImage(r.canvas,0,0),x.save(),x.strokeStyle=ue,x.fillStyle=ue,x.lineWidth=u,x.lineCap="round",x.lineJoin="round",t.rect&&t.rect.w>0&&t.rect.h>0){let P=r.scale;x.strokeRect(t.rect.x*P,t.rect.y*P,t.rect.w*P,t.rect.h*P)}for(let P of i)ut(x,P);o&&ut(x,o),x.restore()}},f=()=>{let x=c.getContext("2d");x&&l(x)},m=x=>{let P=c.getBoundingClientRect(),q=P.width?c.width/P.width:1,z=P.height?c.height/P.height:1;return[(x.clientX-P.left)*q,(x.clientY-P.top)*z]};c.addEventListener("pointerdown",x=>{r&&(x.preventDefault(),c.setPointerCapture(x.pointerId),o={kind:"pen",pts:[m(x)]},f())}),c.addEventListener("pointermove",x=>{o&&(o.pts.push(m(x)),f())});let d=()=>{o&&o.pts.length>=2&&i.push(o),o=null,f()};c.addEventListener("pointerup",d),c.addEventListener("pointercancel",d);let y=v("textarea",{class:"field-input",attrs:{"aria-label":n.comment,placeholder:n.commentPlaceholder,required:"required","data-prevly":"comment"}}),p=t.types.map(x=>v("button",{class:"type-option",text:x.label,attrs:{type:"button",role:"radio","aria-checked":x.id===a?"true":"false","data-prevly-type":x.id},on:{click:()=>{a=x.id;for(let P of p)P.setAttribute("aria-checked",P.getAttribute("data-prevly-type")===x.id?"true":"false")}}})),g=v("div",{class:"type-row",attrs:{role:"radiogroup","aria-label":n.type}},...p),h=v("input",{class:"field-input",attrs:{"aria-label":n.name,placeholder:n.namePlaceholder,"data-prevly":"author"}});h.value=t.author;let w=v("label",{class:"field"},h),b=v("div",{class:"author-known"},v("span",{text:`${n.reportingAs} ${t.author}`}),v("button",{class:"link",text:n.changeName,attrs:{type:"button","data-prevly":"change-name"},on:{click:()=>{b.setAttribute("hidden",""),w.removeAttribute("hidden"),h.focus()}}}));t.askAuthor?t.author?w.setAttribute("hidden",""):b.setAttribute("hidden",""):(w.setAttribute("hidden",""),b.setAttribute("hidden",""));let k=v("div",{class:"error",attrs:{role:"alert"}}),L=v("button",{class:"btn btn-primary",text:n.send,attrs:{type:"button","aria-label":n.send,"data-prevly":"send"},on:{click:()=>void E()}}),N=v("button",{class:"btn",text:n.cancel,attrs:{type:"button","aria-label":n.cancel,"data-prevly":"cancel"},on:{click:()=>t.onCancel()}}),O=v("button",{class:"btn btn-ghost",attrs:{type:"button","aria-label":n.point,"data-prevly":"point"},on:{click:()=>t.onPick()}},j(Ne,"btn-icon"),document.createTextNode(n.point));async function E(){if(s)return;let x=y.value.trim();if(!x){k.textContent=n.commentRequired,y.focus();return}let P=t.askAuthor?h.value.trim():t.author;if(t.askAuthor&&!P){k.textContent=n.nameRequired,w.removeAttribute("hidden"),b.setAttribute("hidden",""),h.focus();return}s=!0,k.textContent="",L.setAttribute("disabled","disabled"),L.textContent=n.sending;let q=null;if(r){let V=document.createElement("canvas");V.width=r.width,V.height=r.height;let G=V.getContext("2d");G&&(l(G),q=await lt(V))}let z=await t.onSubmit({type:a,comment:x,author:P,png:q});s=!1,L.removeAttribute("disabled"),L.textContent=n.send,z&&(k.textContent=z)}let A=r?v("div",{class:"canvas-block"},v("div",{class:"canvas-wrap"},c),v("div",{class:"tools"},v("button",{class:"tool",text:n.undo,attrs:{type:"button","aria-label":n.undo},on:{click:()=>{i.pop(),f()}}}),v("button",{class:"tool",text:n.clear,attrs:{type:"button","aria-label":n.clear},on:{click:()=>{i.length=0,f()}}}))):null,T=v("div",{class:r?"panel panel-wide":"panel",attrs:{role:"dialog","aria-modal":"true","aria-label":n.panel,"data-prevly":"panel"}},v("div",{class:"panel-head"},v("span",{class:"panel-title",text:t.heading??n.panel}),v("button",{class:"icon-button",attrs:{type:"button","aria-label":n.cancel},on:{click:()=>t.onCancel()}},j(K,"icon-button-glyph"))),A,t.shotFailed?v("div",{class:"notice",text:n.noScreenshot}):null,g,v("label",{class:"field"},y),w,b,k,v("div",{class:"panel-actions"},t.allowPick?O:null,N,L),v("div",{class:"send-hint",text:n.sendHint}));T.addEventListener("keydown",x=>{x.key!=="Enter"||!(x.metaKey||x.ctrlKey)||(x.preventDefault(),E())});let I=v("div",{class:r?"panel-backdrop":"panel-anchor"},T);r||I.setAttribute("data-corner",t.corner),r&&I.addEventListener("pointerdown",x=>{x.target===I&&t.onCancel()}),e.appendChild(I);let M=_(I,t.topLayer);return M.show(),f(),y.focus(),{close(){M.destroy()},focus(){y.focus()}}}function fr(e,t){let{labels:n}=t,r=v("div",{class:"panel",attrs:{role:"dialog","aria-modal":"true","aria-label":n.panel,"data-prevly":"panel"}},v("div",{class:"panel-head"},v("span",{class:"panel-title",text:n.panel}),v("button",{class:"icon-button",attrs:{type:"button","aria-label":n.cancel},on:{click:()=>t.onCancel()}},j(K,"icon-button-glyph"))),v("div",{class:"notice",text:n.locked,attrs:{"data-prevly":"locked-message"}}),v("div",{class:"panel-actions"},v("button",{class:"btn",text:n.cancel,attrs:{type:"button","aria-label":n.cancel,"data-prevly":"cancel"},on:{click:()=>t.onCancel()}}))),i=v("div",{class:"panel-anchor",attrs:{"data-corner":t.corner}},r);e.appendChild(i);let o=_(i,t.topLayer);return o.show(),{close(){o.destroy()},focus(){r.focus()}}}function ut(e,t){let n=t.pts[0];if(n){e.beginPath(),e.moveTo(n[0],n[1]);for(let r=1;r<t.pts.length;r+=1){let i=t.pts[r];i&&e.lineTo(i[0],i[1])}e.stroke()}}var mr=new Set(["role","name","aria-label","rel","href"]);function gr(e,t){let n=mr.has(e);n||(n=e.startsWith("data-")&&ne(e));let r=ne(t)&&t.length<100;return r||(r=t.startsWith("#")&&ne(t.slice(1))),n&&r}function hr(e){return ne(e)}function br(e){return ne(e)}function yr(e){return!0}function ft(e,t){if(e.nodeType!==Node.ELEMENT_NODE)throw new Error("Can't generate CSS selector for non-element node type.");if(e.tagName.toLowerCase()==="html")return"html";let n={root:document.body,idName:hr,className:br,tagName:yr,attr:gr,timeoutMs:1e3,seedMinLength:3,optimizedMinLength:2,maxNumberOfPathChecks:1/0},r=new Date,i={...n,...t},o=Er(i.root,n),s,a=0;for(let u of wr(e,i,o)){if(new Date().getTime()-r.getTime()>i.timeoutMs||a>=i.maxNumberOfPathChecks){let f=xr(e,o);if(!f)throw new Error(`Timeout: Can't find a unique selector after ${i.timeoutMs}ms`);return re(f)}if(a++,Ee(u,o)){s=u;break}}if(!s)throw new Error("Selector was not found.");let c=[...ht(s,e,i,o,r)];return c.sort(xe),c.length>0?re(c[0]):re(s)}function*wr(e,t,n){let r=[],i=[],o=e,s=0;for(;o&&o!==n;){let a=vr(o,t);for(let c of a)c.level=s;if(r.push(a),o=o.parentElement,s++,i.push(...gt(r)),s>=t.seedMinLength){i.sort(xe);for(let c of i)yield c;i=[]}}i.sort(xe);for(let a of i)yield a}function ne(e){if(/^[a-z\-]{3,}$/i.test(e)){let t=e.split(/-|[A-Z]/);for(let n of t)if(n.length<=2||/[^aeiou]{4,}/i.test(n))return!1;return!0}return!1}function vr(e,t){let n=[],r=e.getAttribute("id");r&&t.idName(r)&&n.push({name:"#"+CSS.escape(r),penalty:0});for(let s=0;s<e.classList.length;s++){let a=e.classList[s];t.className(a)&&n.push({name:"."+CSS.escape(a),penalty:1})}for(let s=0;s<e.attributes.length;s++){let a=e.attributes[s];t.attr(a.name,a.value)&&n.push({name:`[${CSS.escape(a.name)}="${CSS.escape(a.value)}"]`,penalty:2})}let i=e.tagName.toLowerCase();if(t.tagName(i)){n.push({name:i,penalty:5});let s=ke(e,i);s!==void 0&&n.push({name:mt(i,s),penalty:10})}let o=ke(e);return o!==void 0&&n.push({name:kr(i,o),penalty:50}),n}function re(e){let t=e[0],n=t.name;for(let r=1;r<e.length;r++){let i=e[r].level||0;t.level===i-1?n=`${e[r].name} > ${n}`:n=`${e[r].name} ${n}`,t=e[r]}return n}function pt(e){return e.map(t=>t.penalty).reduce((t,n)=>t+n,0)}function xe(e,t){return pt(e)-pt(t)}function ke(e,t){let n=e.parentNode;if(!n)return;let r=n.firstChild;if(!r)return;let i=0;for(;r&&(r.nodeType===Node.ELEMENT_NODE&&(t===void 0||r.tagName.toLowerCase()===t)&&i++,r!==e);)r=r.nextSibling;return i}function xr(e,t){let n=0,r=e,i=[];for(;r&&r!==t;){let o=r.tagName.toLowerCase(),s=ke(r,o);if(s===void 0)return;i.push({name:mt(o,s),penalty:NaN,level:n}),r=r.parentElement,n++}if(Ee(i,t))return i}function kr(e,t){return e==="html"?"html":`${e}:nth-child(${t})`}function mt(e,t){return e==="html"?"html":`${e}:nth-of-type(${t})`}function*gt(e,t=[]){if(e.length>0)for(let n of e[0])yield*gt(e.slice(1,e.length),t.concat(n));else yield t}function Er(e,t){return e.nodeType===Node.DOCUMENT_NODE?e:e===t.root?e.ownerDocument:e}function Ee(e,t){let n=re(e);switch(t.querySelectorAll(n).length){case 0:throw new Error(`Can't select any node with this selector: ${n}`);case 1:return!0;default:return!1}}function*ht(e,t,n,r,i){if(e.length>2&&e.length>n.optimizedMinLength)for(let o=1;o<e.length-1;o++){if(new Date().getTime()-i.getTime()>n.timeoutMs)return;let a=[...e];a.splice(o,1),Ee(a,r)&&r.querySelector(re(a))===t&&(yield a,yield*ht(a,t,n,r,i))}}var Sr=/^(react-aria|radix|headlessui|mui|chakra|mantine|ant-|css-[a-z0-9]{5,}|:r[0-9a-z]+:)/i,Cr=/[A-Za-z]+[0-9][A-Za-z0-9]{4,}|_{2,}|[0-9a-f]{8,}/;function W(e){return!e||Sr.test(e)?!1:!Cr.test(e)}var Tr=/^(data-(hovered|focused|focus-visible|pressed|selected|open|state|highlighted|placement|rac)|aria-(expanded|selected|checked|pressed|current|activedescendant|describedby|labelledby|controls|owns))$/;function de(e,t){return Tr.test(e)||e==="style"?!1:e==="class"?t.split(/\s+/).filter(Boolean).every(W):e==="id"&&!W(t)?!1:t.length<=80}function yt(e,t=document){let n=t.body??t.documentElement,r=Ar(e,n);if(r&&bt(t,r,e))return R(r,C.selector);let i=Pr(e);return i&&bt(t,i,e)?R(i,C.selector):null}function Ar(e,t){try{return ft(e,{root:t,timeoutMs:800,seedMinLength:2,optimizedMinLength:2,attr:de,idName:W,className:W})}catch{return null}}function Pr(e){let t=[],n=e;for(;n;){let r=n.parentElement,i=n.tagName.toLowerCase();if(!r){t.unshift(i);break}let o=Array.prototype.indexOf.call(r.children,n)+1;if(t.unshift(`${i}:nth-child(${o})`),n=r,t.length>14)return null}return t.length?t.join(" > "):null}function bt(e,t,n){try{let r=e.querySelectorAll(t);return r.length===1&&r[0]===n}catch{return!1}}function pe(e){let t=(e.textContent??"").replace(/\s+/g," ").trim();return R(t,C.elementText)}function wt(e){let t=e.tagName.toLowerCase(),n=typeof e.className=="string"?e.className.trim().split(/\s+/)[0]:"",r=e.id?`#${e.id}`:"";return`${t}${r}${n?`.${n}`:""}`}var vt=["pointerdown","pointerup","mousedown","mouseup","click","contextmenu"];function xt(e,t){let n=v("div",{class:"outline",attrs:{hidden:""}}),r=v("div",{class:"outline-label",attrs:{hidden:""}}),i=v("div",{class:"picker-hint",text:t.pickerHint,attrs:{hidden:""}});e.append(n,r,i);let o=!1,s=null,a=null,c=null,u="",l=(g,h)=>{let w=document.elementFromPoint(g,h);return!w||w===document.documentElement?null:w},f=g=>{let h=g.getBoundingClientRect();n.removeAttribute("hidden"),n.style.left=`${h.left}px`,n.style.top=`${h.top}px`,n.style.width=`${h.width}px`,n.style.height=`${h.height}px`;let w=pe(g);r.textContent=`${wt(g)}${w?` \u2014 ${w.slice(0,60)}`:""}`,r.removeAttribute("hidden");let b=h.top>=24;r.style.left=`${Math.max(4,Math.min(h.left,window.innerWidth-330))}px`,r.style.top=b?`${h.top-22}px`:`${Math.min(h.bottom+4,window.innerHeight-24)}px`},m=g=>{if(!o)return;let h=l(g.clientX,g.clientY);!h||h===s||(s=h,f(h))},d=()=>{o&&s&&f(s)},y=g=>{if(!o||(g.preventDefault(),g.stopPropagation(),g.type!=="click"))return;let h=g,w=l(h.clientX,h.clientY)??s;if(!w)return;let b=w.getBoundingClientRect(),k=a;p(),k?.({el:w,click:{x:h.clientX,y:h.clientY},rect:{x:b.left,y:b.top,w:b.width,h:b.height}})};function p(){if(o){o=!1,s=null,a=null,c=null,n.setAttribute("hidden",""),r.setAttribute("hidden",""),i.setAttribute("hidden",""),document.documentElement.style.cursor=u,document.removeEventListener("mousemove",m,!0),window.removeEventListener("scroll",d,!0),window.removeEventListener("resize",d,!0);for(let g of vt)document.removeEventListener(g,y,!0)}}return{isActive:()=>o,start(g,h){o&&p(),o=!0,a=g,c=h,u=document.documentElement.style.cursor,document.documentElement.style.cursor="crosshair",i.removeAttribute("hidden"),document.addEventListener("mousemove",m,!0),window.addEventListener("scroll",d,!0),window.addEventListener("resize",d,!0);for(let w of vt)document.addEventListener(w,y,!0)},cancel(){let g=c;p(),g?.()}}}function Se(e){return`${e.pathname}${e.search}`}function Rr(e,t){return e.filter(n=>n&&n.page===t).slice().sort(Nr)}function kt(e,t,n,r){let i=[],o=[];return Rr(e,t).forEach((s,a)=>{let c=a+1,u=s.selector?Lr(n,s.selector):null;u&&(!r||!r.contains(u))?i.push({item:s,n:c,el:u}):o.push({item:s,n:c})}),{matched:i,orphans:o}}function Lr(e,t){try{return e.querySelector(t)}catch{return null}}function Nr(e,t){let n=Date.parse(e.created_at??""),r=Date.parse(t.created_at??"");return Number.isFinite(n)&&Number.isFinite(r)&&n!==r?n-r:String(e.id??"").localeCompare(String(t.id??""))}function Et(e,t=Date.now()){let n=Date.parse(e);if(!Number.isFinite(n))return"";let r=Math.max(0,Math.round((t-n)/1e3));return r<60?"just now":r<3600?`${Math.floor(r/60)} min ago`:r<86400?`${Math.floor(r/3600)} h ago`:r<30*86400?`${Math.floor(r/86400)} d ago`:new Date(n).toLocaleDateString()}function St(e,t,n){let r=v("div",{class:"pin-container"});e.append(r);let i=[],o="",s=!0,a=[],c=[],u=new Map,l=null,f=!1,m=0,d=0,y=()=>{for(let E of a){let A=u.get(E.item.id);if(!A)continue;if(!E.el.isConnected){A.setAttribute("hidden","");continue}let T=E.el.getBoundingClientRect();if(T.bottom<-40||T.top>window.innerHeight+40||T.right<-40||T.left>window.innerWidth+40||T.width===0&&T.height===0){A.setAttribute("hidden","");continue}A.removeAttribute("hidden");let M=Math.min(Math.max(T.right-11,2),window.innerWidth-24),x=Math.min(Math.max(T.top-11,2),window.innerHeight-24);A.style.left=`${M}px`,A.style.top=`${x}px`}l&&L(l)},p=()=>{m||(m=requestAnimationFrame(()=>{m=0,s&&y()}))},g=()=>{let E=kt(i,o,document,t);a=E.matched,c=E.orphans;let A=new Map;for(let T of a){let I=u.get(T.item.id),M=I??h(T);M.textContent=String(T.n),A.set(T.item.id,M),I||r.append(M)}for(let[T,I]of u)A.has(T)||I.remove();u=A,r.toggleAttribute("hidden",!s),s&&y()},h=E=>v("button",{class:"pin",attrs:{type:"button","aria-label":`${n.pin} ${E.n} ${n.from} ${E.item.author}`,"data-prevly-pin":E.item.id},on:{click:A=>{A.stopPropagation(),b(E)},mouseenter:()=>{f||w(E)},mouseleave:()=>{f||k()}}}),w=E=>{k();let A=E.item,T=v("div",{class:"popover",attrs:{role:"dialog","aria-label":`${n.pin} ${E.n}`}},v("div",{},v("span",{class:"who",text:A.author}),v("span",{class:"when",text:Et(A.created_at)})),v("div",{class:"body",text:A.comment}),A.comment_url?v("a",{text:n.openReport,attrs:{href:A.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null);T.dataset.pin=A.id,r.append(T),l=T,L(T)},b=E=>{if(f&&l?.dataset.pin===E.item.id){k();return}w(E),f=!0};function k(){l?.remove(),l=null,f=!1}function L(E){let A=E.dataset.pin,T=A?u.get(A):null;if(!T||T.hasAttribute("hidden")){k();return}let I=T.getBoundingClientRect(),M=E.offsetWidth||260,x=E.offsetHeight||120,P=Math.min(Math.max(I.left-M+22,8),window.innerWidth-M-8),q=I.top>x+12?I.top-x-8:I.bottom+8;E.style.left=`${P}px`,E.style.top=`${Math.min(q,window.innerHeight-x-8)}px`}let N=()=>{d&&clearTimeout(d),d=window.setTimeout(()=>{d=0,s&&g()},250)},O=new MutationObserver(N);return O.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class","style","hidden"]}),window.addEventListener("scroll",p,!0),window.addEventListener("resize",p),{update(E,A){i=E,o=A,g()},orphans:()=>c,count:()=>a.length+c.length,setVisible(E){s=E,E||k(),r.toggleAttribute("hidden",!E),E&&g()},isVisible:()=>s,closePopover:k,destroy(){O.disconnect(),window.removeEventListener("scroll",p,!0),window.removeEventListener("resize",p),m&&cancelAnimationFrame(m),d&&clearTimeout(d),k(),r.remove()}}}var Ir=["id","name","type","role","aria-label","title","alt","placeholder","data-testid","data-test","data-cy","data-qa","data-slot","data-key","href"];function Ct(e,t){return{tag:e.tagName.toLowerCase(),text:t,xpath:Or(e),attrs:Mr(e),classes:Tt(e),ancestors:Dr(e),heading:Fr(e)}}function Mr(e){let t={};for(let n of Ir){let r=e.getAttribute(n)?.trim();r&&de(n,r)&&(t[n]=R(r,C.attrValue))}return t}function Tt(e){return(typeof e.className=="string"?e.className:"").trim().split(/\s+/).filter(W).slice(0,C.classes).map(n=>R(n,C.attrValue))}function Or(e){let t=[],n=e;for(;n&&n.nodeType===1;){let r=n.parentElement,i=n.tagName.toLowerCase();if(!r){t.unshift(i);break}let o=Array.prototype.filter.call(r.children,a=>a.tagName===n?.tagName),s=o.indexOf(n)+1;if(t.unshift(o.length>1?`${i}[${s}]`:i),n=r,t.length>C.pathDepth)return null}return t.length?`/${t.join("/")}`:null}function Dr(e){let t=[],n=e.parentElement;for(;n&&n.tagName!=="HTML"&&t.length<C.ancestors;)t.unshift($r(n)),n=n.parentElement;return t}function Fr(e){let t=e;for(;t;){let n=t.previousElementSibling;for(;n;){let r=n.matches("h1,h2,h3,h4,h5,h6")?n:n.querySelector("h1,h2,h3,h4,h5,h6");if(r?.textContent?.trim())return R(r.textContent.replace(/\s+/g," ").trim(),C.elementText);n=n.previousElementSibling}t=t.parentElement}return null}function $r(e){let t=e.tagName.toLowerCase(),n=e.id?`#${e.id}`:"",r=Tt(e)[0];return R(`${t}${n}${r?`.${r}`:""}`,C.attrValue)}function At(e){let{options:t,storage:n}=e,r=t.labels,i=e.api??Re({path:t.endpoint}),o=Ie(),s=null,a=null,c=null,u=null,l=null,f=null,m=null,d=null,y=null,p=null,g=0,h=n.readCorner()??t.position,w=!1,b=!1;function k(){if(s)return;s=document.createElement("prevly-feedback");for(let[F,U]of[["position","fixed"],["inset","0"],["z-index","2147483647"],["pointer-events","none"],["display","block"]])s.style.setProperty(F,U,"important");let S=s.attachShadow({mode:"open"}),D=document.createElement("style");D.textContent=ct,a=v("div",{class:"root"}),S.append(D,a),N();for(let F of["keydown","keyup","keypress"])s.addEventListener(F,U=>U.stopPropagation());document.body.append(s),c=Oe(a,{labels:r,corner:h,topLayer:o,onOpen:()=>T(),onClose:()=>E(),onCorner:F=>{h=F,n.writeCorner(h)}}),w||c.surface.show(),u=_(v("div",{class:"overlay"}),o),a.append(u.node),u.show(),m=St(u.node,s,r),l=_(v("div",{class:"overlay"}),o),a.append(l.node),d=xt(l.node,r),f=_(v("div",{class:"overlay"}),o),a.append(f.node),document.addEventListener("keydown",G,!0),O()}function L(){document.removeEventListener("keydown",G,!0),p?.removeEventListener("change",N),p=null,d?.cancel(),y?.close(),y=null,m?.destroy(),m=null,d=null,c?.destroy(),c=null,u=null,l=null,f=null,g&&clearTimeout(g),a=null,s?.remove(),s=null}function N(){if(!a)return;let S=t.theme;S==="auto"&&(!p&&typeof window.matchMedia=="function"&&(p=window.matchMedia("(prefers-color-scheme: dark)"),p.addEventListener("change",N)),S=p?.matches?"dark":"light"),a.setAttribute("data-theme",S)}async function O(){let S=await i.list();b=S.locked,m&&(m.update(S.items,Se(location)),c?.setCount(m.count()))}function E(){w=!0,c?.surface.hide()}function A(){w&&(w=!1,c?.surface.show())}function T(){y||x(null,null,null)}function I(){!d||!l||(P(),m?.closePopover(),l.show(),d.start(S=>void M(S),()=>l?.hide()))}async function M(S){l?.hide();let D=await z(()=>st(s));x({selector:yt(S.el),element:Ct(S.el,pe(S.el)),click:S.click,rect:S.rect},D,S.rect)}function x(S,D,F){a&&(P(),y=dt(a,{labels:r,corner:h,topLayer:o,shot:D,shotFailed:S!==null&&D===null,rect:F,heading:S?`<${S.element.tag}>`:null,author:t.reporter?.name??n.readAuthor(),askAuthor:t.reporter===null,allowPick:S===null,types:t.types,locked:b,onPick:()=>I(),onCancel:()=>P(),onSubmit:U=>q(U,S)}))}function P(){y?.close(),y=null}async function q(S,D){let F=$e({type:S.type,author:S.author,comment:S.comment,page:Se(location),title:document.title,selector:D?.selector??null,element:D?.element??null,click:D?.click??null,rect:D?.rect??null,viewport:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1},userAgent:navigator.userAgent,console:e.recorder.entries(),context:t.context,network:e.network.entries()}),U=_e(F,r);if(U)return U;let H=await i.submit(F,S.png);return H.ok?(t.reporter===null&&n.writeAuthor(S.author),P(),V(H.item),O(),null):H.kind==="locked"?(b=!0,P(),x(null,null,null),null):H.kind==="rate-limit"?H.retryAfter?`${r.rateLimited} (${r.retryIn} ${H.retryAfter}s)`:r.rateLimited:H.message||r.sendFailed}async function z(S){s&&s.style.setProperty("display","none","important"),await _r();try{return await S()}finally{s&&s.style.setProperty("display","block","important")}}function V(S){f&&(g&&clearTimeout(g),f.node.replaceChildren(v("div",{class:"toast",attrs:{role:"status","data-prevly":"toast","data-corner":h}},document.createTextNode(S.comment_url?r.sent:r.sentPending),S.comment_url?v("a",{text:r.openReport,attrs:{href:S.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null)),f.show(),g=window.setTimeout(()=>{f?.hide(),g=0},9e3))}function G(S){if(S.key==="Escape"){if(y)P();else if(d?.isActive())d.cancel();else{m?.closePopover();return}S.preventDefault(),S.stopPropagation()}}return{mount:k,unmount:L,open(){k(),A(),T()},isMounted:()=>s!==null}}function _r(){return new Promise(e=>{requestAnimationFrame(()=>requestAnimationFrame(()=>e()))})}function qr(e){let t=[];for(let n of e)t.push(Ur(n));return t.join(" ")}function Ur(e){if(typeof e=="string")return e;if(e instanceof Error)return`${e.name}: ${e.message}`;if(e===null)return"null";if(e===void 0)return"undefined";if(typeof e=="object")try{return JSON.stringify(e)??String(e)}catch{return Br(e)}try{return String(e)}catch{return"[unprintable]"}}function Br(e){let t=e.constructor?.name;return t?`[object ${t}]`:"[object]"}function Pt(e={}){let t=e.limit??C.consoleEntries,n=e.maxMessage??C.consoleMessage,r=e.console??(typeof console<"u"?console:void 0),i=e.target===void 0?typeof window<"u"?window:null:e.target,o=e.now??(()=>new Date),s=[],a=(u,l)=>{try{let f=qr(l);if(!f)return;for(s.push({level:u,message:f.length<=n?f:f.slice(0,n),at:o().toISOString()});s.length>t;)s.shift()}catch{}},c=[];if(r)for(let u of["error","warn"]){let l=r[u];if(typeof l!="function")continue;let f=function(...d){try{l.apply(this??r,d)}finally{a(u,d)}};r[u]=f,c.push(()=>{r[u]=l})}if(i){let u=f=>{let m=f,d=m.error;!d&&!m.message||a("error",[d instanceof Error?d:m.message])},l=f=>{let m=f.reason;a("error",["Unhandled rejection:",m])};try{i.addEventListener("error",u),i.addEventListener("unhandledrejection",l),c.push(()=>{i.removeEventListener("error",u),i.removeEventListener("unhandledrejection",l)})}catch{}}return{entries:()=>s.slice(),record:a,stop:()=>{for(;c.length;){let u=c.pop();try{u?.()}catch{}}}}}function Hr(e){return typeof e=="object"&&e!==null&&"name"in e&&e.name==="AbortError"}function Rt(e={}){let t=e.limit??C.networkEntries,n=e.target??(typeof window<"u"?window:{}),r=e.base??(typeof location<"u"?location.href:"http://localhost/"),i=e.now??(()=>new Date),o=e.requestIdHeader||"x-request-id",s=e.origins?.slice()??[],a=[],c=[],u=(d,y)=>{let p="",g=!1;try{let h=new URL(String(y??""),r);p=h.pathname,g=s.includes(h.origin)}catch{}return{method:(d||"GET").toUpperCase().slice(0,10),path:R(p,C.networkPath),watched:g}},l=(d,y,p)=>{if(!d.watched||y!==0&&y<500)return;let g={method:d.method,path:d.path,status:y,at:i().toISOString()};for(p&&(g.requestId=R(p,C.requestId)),a.push(g);a.length>t;)a.shift()},f=n.fetch;if(typeof f=="function"){let d=async function(p,g){let h=null;try{let w=typeof p=="string"||p instanceof URL?p:p.url,b=g?.method??(typeof p=="object"&&"method"in p?p.method:"GET");h=u(String(b),w)}catch{h=null}try{let w=await f.call(this??n,p,g);if(h){let b=null;try{b=w.headers?.get(o)??null}catch{}l(h,w.status,b)}return w}catch(w){throw h&&!Hr(w)&&l(h,0,null),w}};n.fetch=d,c.push(()=>{n.fetch=f})}let m=n.XMLHttpRequest;if(typeof m=="function"){let d=m.prototype,y=d.open,p=d.send,g=Symbol("prevly.network");d.open=function(w,b,...k){try{this[g]=u(w,b)}catch{this[g]=null}return y.call(this,w,b,...k)},d.send=function(...w){try{let b=this[g];if(b){let k=L=>{let N=null;try{N=this.getResponseHeader(o)}catch{}l(b,L,N)};this.addEventListener("load",()=>k(this.status)),this.addEventListener("error",()=>k(0)),this.addEventListener("timeout",()=>k(0))}}catch{}return p.call(this,...w)},c.push(()=>{d.open=y,d.send=p})}return{entries:()=>a.slice(),origins:()=>s.slice(),setOrigins(d){s=d.slice()},setRequestIdHeader(d){o=d||"x-request-id"},stop(){for(;c.length;){let d=c.pop();try{d?.()}catch{}}}}}var Lt="prevly.feedback.author";function Nt(){try{return window.localStorage}catch{return null}}function It(e,t){let n=`prevly.feedback.corner:${t}`;return{readAuthor(){try{return e?.getItem(Lt)??""}catch{return""}},writeAuthor(r){try{e?.setItem(Lt,r)}catch{}},readCorner(){try{let r=e?.getItem(n);return ge.includes(r)?r:null}catch{return null}},writeCorner(r){try{e?.setItem(n,r)}catch{}}}}var Ce=null;function Te(){Ce||(Ce={console:Pt(),network:Rt()})}function Mt(e){let t={open:()=>{},unmount:()=>{}};try{if(typeof document>"u"||typeof window>"u")return t;let n=Fe(e);if(!n.endpoint)return t;Te();let r=Ce;r.network.setOrigins(n.origins),r.network.setRequestIdHeader(n.requestIdHeader);let i=At({options:n,recorder:r.console,network:r.network,storage:It(Nt(),location.host)});return jr(()=>{try{i.mount()}catch(o){console.debug("[prevly] feedback mount failed",o)}}),{open(){try{i.open()}catch(o){console.debug("[prevly] feedback open failed",o)}},unmount(){try{i.unmount()}catch(o){console.debug("[prevly] feedback unmount failed",o)}}}}catch(n){return console.debug("[prevly] feedback widget failed to start",n),t}}function jr(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}var Wr=Pe(document.currentScript?.getAttribute("data-endpoint"));Te();var Ot=Mt({endpoint:Wr});window.__prevlyFeedback={open:()=>Ot.open(),hide:()=>Ot.unmount()};})();
