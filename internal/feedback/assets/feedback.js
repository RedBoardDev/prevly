/* prevly preview feedback widget */
"use strict";(()=>{var te="prevly.feedback",ne="prevly.feedback.author",he="prevly_feedback",ft="#prevly-feedback";function be(e){let t;try{t=new URL(e)}catch{return{requested:!1,cleanedUrl:null}}let n=t.searchParams.get(he)==="1",r=t.hash===ft;return!n&&!r?{requested:!1,cleanedUrl:null}:(n&&t.searchParams.delete(he),r&&(t.hash=""),{requested:!0,cleanedUrl:t.pathname+t.search+t.hash})}function we(e){try{return e.getItem(te)==="1"}catch{return!1}}function B(e,t){try{t?e.setItem(te,"1"):e.removeItem(te)}catch{}}var mt="/_prevly/api/feedback";function ye(e={}){let t=e.path??mt,n=e.fetchImpl??((...r)=>fetch(...r));return{async list(){try{let r=await n(t,{method:"GET",headers:{accept:"application/json"},credentials:"same-origin"});if(!r.ok)return[];let o=await r.json();return Array.isArray(o?.items)?o.items:[]}catch{return[]}},async submit(r,o){let i=new FormData;i.append("meta",new Blob([JSON.stringify(r)],{type:"application/json"}),"meta.json"),o&&i.append("screenshot",o,"screenshot.png");let s;try{s=await n(t,{method:"POST",body:i,credentials:"same-origin"})}catch(a){return{ok:!1,kind:"error",message:ht(a)}}if(s.status===429)return{ok:!1,kind:"rate-limit",retryAfter:pt(s.headers?.get("retry-after")??null),message:"Too many reports from this preview. Try again in a moment."};if(s.status===201||s.status===200){try{let a=await s.json();if(a?.item)return{ok:!0,item:a.item}}catch{}return{ok:!1,kind:"error",message:"The server returned an unexpected answer."}}return{ok:!1,kind:"error",message:await gt(s)}}}}function pt(e){if(!e)return null;let t=Number.parseInt(e,10);if(Number.isFinite(t)&&t>=0)return t;let n=Date.parse(e);return Number.isFinite(n)?Math.max(0,Math.round((n-Date.now())/1e3)):null}async function gt(e){try{let t=await e.json(),n=typeof t?.error=="string"?t.error:t?.message;if(typeof n=="string"&&n)return`${e.status} \xB7 ${n}`}catch{}return`Sending failed (HTTP ${e.status}).`}function ht(e){return e instanceof Error&&e.message?e.message:"Network error."}function v(e,t={},...n){let r=document.createElement(e);if(t.class&&(r.className=t.class),t.text!==void 0&&(r.textContent=t.text),t.html!==void 0&&(r.innerHTML=t.html),t.style&&Object.assign(r.style,t.style),t.attrs)for(let[o,i]of Object.entries(t.attrs))r.setAttribute(o,i);if(t.on)for(let[o,i]of Object.entries(t.on))r.addEventListener(o,i);for(let o of n)o==null||o===!1||r.append(o);return r}function ve(e){for(;e.firstChild;)e.removeChild(e.firstChild)}var Ae="[modern-screenshot]",_=typeof window<"u",bt=_&&"Worker"in window,ir=_&&"atob"in window,ar=_&&"btoa"in window,ie=_?window.navigator?.userAgent:"",Pe=ie.includes("Chrome"),G=ie.includes("AppleWebKit")&&!Pe,ae=ie.includes("Firefox"),wt=e=>e&&"__CONTEXT__"in e,yt=e=>e.constructor.name==="CSSFontFaceRule",vt=e=>e.constructor.name==="CSSImportRule",xt=e=>e.constructor.name==="CSSLayerBlockRule",D=e=>e.nodeType===1,V=e=>typeof e.className=="object",Me=e=>e.tagName==="image",Et=e=>e.tagName==="use",q=e=>D(e)&&typeof e.style<"u"&&!V(e),kt=e=>e.nodeType===8,St=e=>e.nodeType===3,j=e=>e.tagName==="IMG",K=e=>e.tagName==="VIDEO",Ct=e=>e.tagName==="CANVAS",Tt=e=>e.tagName==="TEXTAREA",At=e=>e.tagName==="INPUT",Pt=e=>e.tagName==="STYLE",Mt=e=>e.tagName==="SCRIPT",Nt=e=>e.tagName==="SELECT",Lt=e=>e.tagName==="SLOT",It=e=>e.tagName==="IFRAME",Rt=(...e)=>console.warn(Ae,...e);function Ft(e){let t=e?.createElement?.("canvas");return t&&(t.height=t.width=1),!!t&&"toDataURL"in t&&!!t.toDataURL("image/webp").includes("image/webp")}var re=e=>e.startsWith("data:");function Ne(e,t){if(e.match(/^[a-z]+:\/\//i))return e;if(_&&e.match(/^\/\//))return window.location.protocol+e;if(e.match(/^[a-z]+:/i)||!_)return e;let n=J().implementation.createHTMLDocument(),r=n.createElement("base"),o=n.createElement("a");return n.head.appendChild(r),n.body.appendChild(o),t&&(r.href=t),o.href=e,o.href}function J(e){return(e&&D(e)?e?.ownerDocument:e)??window.document}var Q="http://www.w3.org/2000/svg";function $t(e,t,n){let r=J(n).createElementNS(Q,"svg");return r.setAttributeNS(null,"width",e.toString()),r.setAttributeNS(null,"height",t.toString()),r.setAttributeNS(null,"viewBox",`0 0 ${e} ${t}`),r}function Dt(e,t){let n=new XMLSerializer().serializeToString(e);return t&&(n=n.replace(/[\u0000-\u0008\v\f\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu,"")),`data:image/svg+xml;charset=utf-8,${encodeURIComponent(n)}`}function Ut(e,t){return new Promise((n,r)=>{let o=new FileReader;o.onload=()=>n(o.result),o.onerror=()=>r(o.error),o.onabort=()=>r(new Error(`Failed read blob to ${t}`)),t==="dataUrl"?o.readAsDataURL(e):t==="arrayBuffer"&&o.readAsArrayBuffer(e)})}var _t=e=>Ut(e,"dataUrl");function H(e,t){let n=J(t).createElement("img");return n.decoding="sync",n.loading="eager",n.src=e,n}function z(e,t){return new Promise(n=>{let{timeout:r,ownerDocument:o,onError:i,onWarn:s}=t??{},a=typeof e=="string"?H(e,J(o)):e,c=null,u=null;function l(){n(a),c&&clearTimeout(c),u?.()}if(r&&(c=setTimeout(l,r)),K(a)){let m=a.currentSrc||a.src;if(!m)return a.poster?z(a.poster,t).then(n):l();if(a.readyState>=2)return l();let f=l,p=b=>{s?.("Failed video load",m,b),i?.(b),l()};u=()=>{a.removeEventListener("loadeddata",f),a.removeEventListener("error",p)},a.addEventListener("loadeddata",f,{once:!0}),a.addEventListener("error",p,{once:!0})}else{let m=Me(a)?a.href.baseVal:a.currentSrc||a.src;if(!m)return l();let f=async()=>{if(j(a)&&"decode"in a)try{await a.decode()}catch(b){s?.("Failed to decode image, trying to render anyway",a.dataset.originalSrc||m,b)}l()},p=b=>{s?.("Failed image load",a.dataset.originalSrc||m,b),l()};if(j(a)&&a.complete)return f();u=()=>{a.removeEventListener("load",f),a.removeEventListener("error",p)},a.addEventListener("load",f,{once:!0}),a.addEventListener("error",p,{once:!0})}})}async function Ot(e,t){q(e)&&(j(e)||K(e)?await z(e,t):await Promise.all(["img","video"].flatMap(n=>Array.from(e.querySelectorAll(n)).map(r=>z(r,t)))))}var Le=(function(){let t=0,n=()=>`0000${(Math.random()*36**4<<0).toString(36)}`.slice(-4);return()=>(t+=1,`u${n()}${t}`)})();function Ie(e){return e?.split(",").map(t=>t.trim().replace(/"|'/g,"").toLowerCase()).filter(Boolean)}var xe=0;function Bt(e){let t=`${Ae}[#${xe}]`;return xe++,{time:n=>e&&console.time(`${t} ${n}`),timeEnd:n=>e&&console.timeEnd(`${t} ${n}`),warn:(...n)=>e&&Rt(...n)}}function Ht(e){return{cache:e?"no-cache":"force-cache"}}async function Re(e,t){return wt(e)?e:jt(e,{...t,autoDestruct:!0})}async function jt(e,t){let{scale:n=1,workerUrl:r,workerNumber:o=1}=t||{},i=!!t?.debug,s=t?.features??!0,a=e.ownerDocument??(_?window.document:void 0),c=e.ownerDocument?.defaultView??(_?window:void 0),u=new Map,l={width:0,height:0,quality:1,type:"image/png",scale:n,backgroundColor:null,style:null,filter:null,maximumCanvasSize:0,timeout:3e4,progress:null,debug:i,fetch:{requestInit:Ht(t?.fetch?.bypassingCache),placeholderImage:"data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",bypassingCache:!1,...t?.fetch},fetchFn:null,font:{},drawImageInterval:100,workerUrl:null,workerNumber:o,onCloneEachNode:null,onCloneNode:null,onEmbedNode:null,onCreateForeignObjectSvg:null,includeStyleProperties:null,autoDestruct:!1,...t,__CONTEXT__:!0,log:Bt(i),node:e,ownerDocument:a,ownerWindow:c,dpi:n===1?null:96*n,svgStyleElement:Fe(a),svgDefsElement:a?.createElementNS(Q,"defs"),svgStyles:new Map,defaultComputedStyles:new Map,workers:[...Array.from({length:bt&&r&&o?o:0})].map(()=>{try{let p=new Worker(r);return p.onmessage=async b=>{let{url:d,result:h}=b.data;h?u.get(d)?.resolve?.(h):u.get(d)?.reject?.(new Error(`Error receiving message from worker: ${d}`))},p.onmessageerror=b=>{let{url:d}=b.data;u.get(d)?.reject?.(new Error(`Error receiving message from worker: ${d}`))},p}catch(p){return l.log.warn("Failed to new Worker",p),null}}).filter(Boolean),fontFamilies:new Map,fontCssTexts:new Map,acceptOfImage:`${[Ft(a)&&"image/webp","image/svg+xml","image/*","*/*"].filter(Boolean).join(",")};q=0.8`,requests:u,drawImageCount:0,tasks:[],features:s,isEnable:p=>p==="restoreScrollPosition"?typeof s=="boolean"?!1:s[p]??!1:typeof s=="boolean"?s:s[p]??!0,shadowRoots:[]};l.log.time("wait until load"),await Ot(e,{timeout:l.timeout,onWarn:l.log.warn}),l.log.timeEnd("wait until load");let{width:m,height:f}=qt(e,l);return l.width=m,l.height=f,l}function Fe(e){if(!e)return;let t=e.createElement("style"),n=t.ownerDocument.createTextNode(`
.______background-clip--text {
  background-clip: text;
  -webkit-background-clip: text;
}
`);return t.appendChild(n),t}function qt(e,t){let{width:n,height:r}=t;if(D(e)&&(!n||!r)){let o=e.getBoundingClientRect();n=n||o.width||Number(e.getAttribute("width"))||0,r=r||o.height||Number(e.getAttribute("height"))||0}return{width:n,height:r}}async function zt(e,t){let{log:n,timeout:r,drawImageCount:o,drawImageInterval:i}=t;n.time("image to canvas");let s=await z(e,{timeout:r,onWarn:t.log.warn}),{canvas:a,context2d:c}=Wt(e.ownerDocument,t),u=()=>{try{c?.drawImage(s,0,0,a.width,a.height)}catch(l){t.log.warn("Failed to drawImage",l)}};if(u(),t.isEnable("fixSvgXmlDecode"))for(let l=0;l<o;l++)await new Promise(m=>{setTimeout(()=>{c?.clearRect(0,0,a.width,a.height),u(),m()},l+i)});return t.drawImageCount=0,n.timeEnd("image to canvas"),a}function Wt(e,t){let{width:n,height:r,scale:o,backgroundColor:i,maximumCanvasSize:s}=t,a=e.createElement("canvas");a.width=Math.floor(n*o),a.height=Math.floor(r*o),a.style.width=`${n}px`,a.style.height=`${r}px`,s&&(a.width>s||a.height>s)&&(a.width>s&&a.height>s?a.width>a.height?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s):a.width>s?(a.height*=s/a.width,a.width=s):(a.width*=s/a.height,a.height=s));let c=a.getContext("2d");return c&&i&&(c.fillStyle=i,c.fillRect(0,0,a.width,a.height)),{canvas:a,context2d:c}}function $e(e,t){if(e.ownerDocument)try{let i=e.toDataURL();if(i!=="data:,")return H(i,e.ownerDocument)}catch(i){t.log.warn("Failed to clone canvas",i)}let n=e.cloneNode(!1),r=e.getContext("2d"),o=n.getContext("2d");try{return r&&o&&o.putImageData(r.getImageData(0,0,e.width,e.height),0,0),n}catch(i){t.log.warn("Failed to clone canvas",i)}return n}function Vt(e,t){try{if(e?.contentDocument?.documentElement)return se(e.contentDocument.documentElement,t)}catch(n){t.log.warn("Failed to clone iframe",n)}return e.cloneNode(!1)}function Yt(e){let t=e.cloneNode(!1);return e.currentSrc&&e.currentSrc!==e.src&&(t.src=e.currentSrc,t.srcset=""),t.loading==="lazy"&&(t.loading="eager"),t}async function Xt(e,t){if(e.ownerDocument&&!e.currentSrc&&e.poster)return H(e.poster,e.ownerDocument);let n=e.cloneNode(!1);n.crossOrigin="anonymous",e.currentSrc&&e.currentSrc!==e.src&&(n.src=e.currentSrc);let r=n.ownerDocument;if(r){let o=!0;if(await z(n,{onError:()=>o=!1,onWarn:t.log.warn}),!o)return e.poster?H(e.poster,e.ownerDocument):n;n.currentTime=e.currentTime,await new Promise(s=>{n.addEventListener("seeked",s,{once:!0})});let i=r.createElement("canvas");i.width=e.offsetWidth,i.height=e.offsetHeight;try{let s=i.getContext("2d");s&&s.drawImage(n,0,0,i.width,i.height)}catch(s){return t.log.warn("Failed to clone video",s),e.poster?H(e.poster,e.ownerDocument):n}return $e(i,t)}return n}function Gt(e,t){return Ct(e)?$e(e,t):It(e)?Vt(e,t):j(e)?Yt(e):K(e)?Xt(e,t):e.cloneNode(!1)}function Kt(e){let t=e.sandbox;if(!t){let{ownerDocument:n}=e;try{n&&(t=n.createElement("iframe"),t.id=`__SANDBOX__${Le()}`,t.width="0",t.height="0",t.style.visibility="hidden",t.style.position="fixed",n.body.appendChild(t),t.srcdoc='<!DOCTYPE html><meta charset="UTF-8"><title></title><body>',e.sandbox=t)}catch(r){e.log.warn("Failed to getSandBox",r)}}return t}var Jt=["width","height","-webkit-text-fill-color"],Qt=["stroke","fill"];function De(e,t,n){let{defaultComputedStyles:r}=n,o=e.nodeName.toLowerCase(),i=V(e)&&o!=="svg",s=i?Qt.map(d=>[d,e.getAttribute(d)]).filter(([,d])=>d!==null):[],a=[i&&"svg",o,s.map((d,h)=>`${d}=${h}`).join(","),t].filter(Boolean).join(":");if(r.has(a))return r.get(a);let u=Kt(n)?.contentWindow;if(!u)return new Map;let l=u?.document,m,f;i?(m=l.createElementNS(Q,"svg"),f=m.ownerDocument.createElementNS(m.namespaceURI,o),s.forEach(([d,h])=>{f.setAttributeNS(null,d,h)}),m.appendChild(f)):m=f=l.createElement(o),f.textContent=" ",l.body.appendChild(m);let p=u.getComputedStyle(f,t),b=new Map;for(let d=p.length,h=0;h<d;h++){let w=p.item(h);Jt.includes(w)||b.set(w,p.getPropertyValue(w))}return l.body.removeChild(m),r.set(a,b),b}function Ue(e,t,n){let r=new Map,o=[],i=new Map;if(n)for(let a of n)s(a);else for(let a=e.length,c=0;c<a;c++){let u=e.item(c);s(u)}for(let a=o.length,c=0;c<a;c++)i.get(o[c])?.forEach((u,l)=>r.set(l,u));function s(a){let c=e.getPropertyValue(a),u=e.getPropertyPriority(a),l=a.lastIndexOf("-"),m=l>-1?a.substring(0,l):void 0;if(m){let f=i.get(m);f||(f=new Map,i.set(m,f)),f.set(a,[c,u])}t.get(a)===c&&!u||(m?o.push(m):r.set(a,[c,u]))}return r}function Zt(e,t,n,r){let{ownerWindow:o,includeStyleProperties:i,currentParentNodeStyle:s}=r,a=t.style,c=o.getComputedStyle(e),u=De(e,null,r);s?.forEach((m,f)=>{u.delete(f)});let l=Ue(c,u,i);l.delete("transition-property"),l.delete("all"),l.delete("d"),l.delete("content"),n&&(l.delete("position"),l.delete("margin-top"),l.delete("margin-right"),l.delete("margin-bottom"),l.delete("margin-left"),l.delete("margin-block-start"),l.delete("margin-block-end"),l.delete("margin-inline-start"),l.delete("margin-inline-end"),l.set("box-sizing",["border-box",""])),l.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text"),Pe&&(l.has("font-kerning")||l.set("font-kerning",["normal",""]),(l.get("overflow-x")?.[0]==="hidden"||l.get("overflow-y")?.[0]==="hidden")&&l.get("text-overflow")?.[0]==="ellipsis"&&e.scrollWidth===e.clientWidth&&l.set("text-overflow",["clip",""]));for(let m=a.length,f=0;f<m;f++)a.removeProperty(a.item(f));return l.forEach(([m,f],p)=>{a.setProperty(p,m,f)}),l}function en(e,t){(Tt(e)||At(e)||Nt(e))&&t.setAttribute("value",e.value)}var tn=["::before","::after"],nn=["::-webkit-scrollbar","::-webkit-scrollbar-button","::-webkit-scrollbar-thumb","::-webkit-scrollbar-track","::-webkit-scrollbar-track-piece","::-webkit-scrollbar-corner","::-webkit-resizer"];function rn(e,t,n,r,o){let{ownerWindow:i,svgStyleElement:s,svgStyles:a,currentNodeStyle:c}=r;if(!s||!i)return;function u(l){let m=i.getComputedStyle(e,l),f=m.getPropertyValue("content");if(!f||f==="none")return;o?.(f),f=f.replace(/(')|(")|(counter\(.+\))/g,"");let p=[Le()],b=De(e,l,r);c?.forEach((k,A)=>{b.delete(A)});let d=Ue(m,b,r.includeStyleProperties);d.delete("content"),d.delete("-webkit-locale"),d.get("background-clip")?.[0]==="text"&&t.classList.add("______background-clip--text");let h=[`content: '${f}';`];if(d.forEach(([k,A],F)=>{h.push(`${F}: ${k}${A?" !important":""};`)}),h.length===1)return;try{t.className=[t.className,...p].join(" ")}catch(k){r.log.warn("Failed to copyPseudoClass",k);return}let w=h.join(`
  `),E=a.get(w);E||(E=[],a.set(w,E)),E.push(`.${p[0]}${l}`)}tn.forEach(u),n&&nn.forEach(u)}var Ee=new Set(["symbol"]);async function ke(e,t,n,r,o){if(D(n)&&(Pt(n)||Mt(n))||r.filter&&!r.filter(n))return;Ee.has(t.nodeName)||Ee.has(n.nodeName)?r.currentParentNodeStyle=void 0:r.currentParentNodeStyle=r.currentNodeStyle;let i=await se(n,r,!1,o);r.isEnable("restoreScrollPosition")&&on(e,i),t.appendChild(i)}async function Se(e,t,n,r){let o=e.firstChild;D(e)&&e.shadowRoot&&(o=e.shadowRoot?.firstChild,n.shadowRoots.push(e.shadowRoot));for(let i=o;i;i=i.nextSibling)if(!kt(i))if(D(i)&&Lt(i)&&typeof i.assignedNodes=="function"){let s=i.assignedNodes();for(let a=0;a<s.length;a++)await ke(e,t,s[a],n,r)}else await ke(e,t,i,n,r)}function on(e,t){if(!q(e)||!q(t))return;let{scrollTop:n,scrollLeft:r}=e;if(!n&&!r)return;let{transform:o}=t.style,i=new DOMMatrix(o),{a:s,b:a,c,d:u}=i;i.a=1,i.b=0,i.c=0,i.d=1,i.translateSelf(-r,-n),i.a=s,i.b=a,i.c=c,i.d=u,t.style.transform=i.toString()}function an(e,t){let{backgroundColor:n,width:r,height:o,style:i}=t,s=e.style;if(n&&s.setProperty("background-color",n,"important"),r&&s.setProperty("width",`${r}px`,"important"),o&&s.setProperty("height",`${o}px`,"important"),i)for(let a in i)s[a]=i[a]}var sn=/^[\w-:]+$/;async function se(e,t,n=!1,r){let{ownerDocument:o,ownerWindow:i,fontFamilies:s,onCloneEachNode:a}=t;if(o&&St(e))return r&&/\S/.test(e.data)&&r(e.data),o.createTextNode(e.data);if(o&&i&&D(e)&&(q(e)||V(e))){let u=await Gt(e,t);if(t.isEnable("removeAbnormalAttributes")){let d=u.getAttributeNames();for(let h=d.length,w=0;w<h;w++){let E=d[w];sn.test(E)||u.removeAttribute(E)}}let l=t.currentNodeStyle=Zt(e,u,n,t);n&&an(u,t);let m=!1;if(t.isEnable("copyScrollbar")){let d=[l.get("overflow-x")?.[0],l.get("overflow-y")?.[0]];m=d.includes("scroll")||(d.includes("auto")||d.includes("overlay"))&&(e.scrollHeight>e.clientHeight||e.scrollWidth>e.clientWidth)}let f=l.get("text-transform")?.[0],p=Ie(l.get("font-family")?.[0]),b=p?d=>{f==="uppercase"?d=d.toUpperCase():f==="lowercase"?d=d.toLowerCase():f==="capitalize"&&(d=d[0].toUpperCase()+d.substring(1)),p.forEach(h=>{let w=s.get(h);w||s.set(h,w=new Set),d.split("").forEach(E=>w.add(E))})}:void 0;return rn(e,u,m,t,b),en(e,u),K(e)||await Se(e,u,t,b),await a?.(u),u}let c=e.cloneNode(!1);return await Se(e,c,t),await a?.(c),c}function ln(e){if(e.ownerDocument=void 0,e.ownerWindow=void 0,e.svgStyleElement=void 0,e.svgDefsElement=void 0,e.svgStyles.clear(),e.defaultComputedStyles.clear(),e.sandbox){try{e.sandbox.remove()}catch(t){e.log.warn("Failed to destroyContext",t)}e.sandbox=void 0}e.workers=[],e.fontFamilies.clear(),e.fontCssTexts.clear(),e.requests.clear(),e.tasks=[],e.shadowRoots=[]}function cn(e){let{url:t,timeout:n,responseType:r,...o}=e,i=new AbortController,s=n?setTimeout(()=>i.abort(),n):void 0;return fetch(t,{signal:i.signal,...o}).then(a=>{if(!a.ok)throw new Error("Failed fetch, not 2xx response",{cause:a});switch(r){case"arrayBuffer":return a.arrayBuffer();case"dataUrl":return a.blob().then(_t);case"text":default:return a.text()}}).finally(()=>clearTimeout(s))}function W(e,t){let{url:n,requestType:r="text",responseType:o="text",imageDom:i}=t,s=n,{timeout:a,acceptOfImage:c,requests:u,fetchFn:l,fetch:{requestInit:m,bypassingCache:f,placeholderImage:p},font:b,workers:d,fontFamilies:h}=e;r==="image"&&(G||ae)&&e.drawImageCount++;let w=u.get(n);if(!w){f&&f instanceof RegExp&&f.test(s)&&(s+=(/\?/.test(s)?"&":"?")+new Date().getTime());let E=r.startsWith("font")&&b&&b.minify,k=new Set;E&&r.split(";")[1].split(",").forEach(x=>{h.has(x)&&h.get(x).forEach(S=>k.add(S))});let A=E&&k.size,F={url:s,timeout:a,responseType:A?"arrayBuffer":o,headers:r==="image"?{accept:c}:void 0,...m};w={type:r,resolve:void 0,reject:void 0,response:null},w.response=(async()=>{if(l&&r==="image"){let P=await l(n);if(P)return P}return!G&&n.startsWith("http")&&d.length?new Promise((P,x)=>{d[u.size&d.length-1].postMessage({rawUrl:n,...F}),w.resolve=P,w.reject=x}):cn(F)})().catch(P=>{if(u.delete(n),r==="image"&&p)return e.log.warn("Failed to fetch image base64, trying to use placeholder image",s),typeof p=="string"?p:p(i);throw P}),u.set(n,w)}return w.response}async function _e(e,t,n,r){if(!Oe(e))return e;for(let[o,i]of un(e,t))try{let s=await W(n,{url:i,requestType:r?"image":"text",responseType:"dataUrl"});e=e.replace(dn(o),`$1${s}$3`)}catch(s){n.log.warn("Failed to fetch css data url",o,s)}return e}function Oe(e){return/url\((['"]?)([^'"]+?)\1\)/.test(e)}var Be=/url\((['"]?)([^'"]+?)\1\)/g;function un(e,t){let n=[];return e.replace(Be,(r,o,i)=>(n.push([i,Ne(i,t)]),r)),n.filter(([r])=>!re(r))}function dn(e){let t=e.replace(/([.*+?^${}()|\[\]\/\\])/g,"\\$1");return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`,"g")}var fn=["background-image","border-image-source","-webkit-border-image","-webkit-mask-image","list-style-image"];function mn(e,t){return fn.map(n=>{let r=e.getPropertyValue(n);return!r||r==="none"?null:((G||ae)&&t.drawImageCount++,_e(r,null,t,!0).then(o=>{!o||r===o||e.setProperty(n,o,e.getPropertyPriority(n))}))}).filter(Boolean)}function pn(e,t){if(j(e)){let n=e.currentSrc||e.src;if(!re(n))return[W(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.srcset="",e.dataset.originalSrc=n,e.src=r||"")})];(G||ae)&&t.drawImageCount++}else if(V(e)&&!re(e.href.baseVal)){let n=e.href.baseVal;return[W(t,{url:n,imageDom:e,requestType:"image",responseType:"dataUrl"}).then(r=>{r&&(e.dataset.originalSrc=n,e.href.baseVal=r||"")})]}return[]}function gn(e,t){let{ownerDocument:n,svgDefsElement:r}=t,o=e.getAttribute("href")??e.getAttribute("xlink:href");if(!o)return[];let[i,s]=o.split("#");if(s){let a=`#${s}`,c=t.shadowRoots.reduce((u,l)=>u??l.querySelector(`svg ${a}`),n?.querySelector(`svg ${a}`));if(i&&e.setAttribute("href",a),r?.querySelector(a))return[];if(c)return r?.appendChild(c.cloneNode(!0)),[];if(i)return[W(t,{url:i,responseType:"text"}).then(u=>{r?.insertAdjacentHTML("beforeend",u)})]}return[]}function He(e,t){let{tasks:n}=t;D(e)&&((j(e)||Me(e))&&n.push(...pn(e,t)),Et(e)&&n.push(...gn(e,t))),q(e)&&n.push(...mn(e.style,t)),e.childNodes.forEach(r=>{He(r,t)})}async function hn(e,t){let{ownerDocument:n,svgStyleElement:r,fontFamilies:o,fontCssTexts:i,tasks:s,font:a}=t;if(!(!n||!r||!o.size))if(a&&a.cssText){let c=Te(a.cssText,t);r.appendChild(n.createTextNode(`${c}
`))}else{let c=Array.from(n.styleSheets).filter(p=>{try{return"cssRules"in p&&!!p.cssRules.length}catch(b){return t.log.warn(`Error while reading CSS rules from ${p.href}`,b),!1}}),u=n.implementation.createHTMLDocument(""),l=u.createElement("style");u.head.appendChild(l);let m=l.sheet;await Promise.all(c.flatMap(p=>Array.from(p.cssRules).map(async b=>{if(vt(b)){let d=b.href,h="";try{h=await W(t,{url:d,requestType:"text",responseType:"text"})}catch(E){t.log.warn(`Error fetch remote css import from ${d}`,E)}let w=h.replace(Be,(E,k,A)=>E.replace(A,Ne(A,d)));for(let E of wn(w))try{m.insertRule(E,m.cssRules.length)}catch(k){t.log.warn("Error inserting rule from remote css import",{rule:E,error:k})}}}))),m.cssRules.length&&c.push(m);let f=[];c.forEach(p=>{oe(p.cssRules,f)}),f.filter(p=>yt(p)&&Oe(p.style.getPropertyValue("src"))&&Ie(p.style.getPropertyValue("font-family"))?.some(b=>o.has(b))).forEach(p=>{let b=p,d=i.get(b.cssText);d?r.appendChild(n.createTextNode(`${d}
`)):s.push(_e(b.cssText,b.parentStyleSheet?b.parentStyleSheet.href:null,t).then(h=>{h=Te(h,t),i.set(b.cssText,h),r.appendChild(n.createTextNode(`${h}
`))}))})}}var bn=/(\/\*[\s\S]*?\*\/)/g,Ce=/((@.*?keyframes [\s\S]*?){([\s\S]*?}\s*?)})/gi;function wn(e){if(e==null)return[];let t=[],n=e.replace(bn,"");for(;;){let i=Ce.exec(n);if(!i)break;t.push(i[0])}n=n.replace(Ce,"");let r=/@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi,o=new RegExp("((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})","gi");for(;;){let i=r.exec(n);if(i)o.lastIndex=r.lastIndex;else if(i=o.exec(n),i)r.lastIndex=o.lastIndex;else break;t.push(i[0])}return t}var yn=/url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g,vn=/src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;function Te(e,t){let{font:n}=t,r=n?n?.preferredFormat:void 0;return r?e.replace(vn,o=>{for(;;){let[i,,s]=yn.exec(o)||[];if(!s)return"";if(s===r)return`src: ${i};`}}):e}function oe(e,t=[]){for(let n of Array.from(e))xt(n)?t.push(...oe(n.cssRules)):"cssRules"in n?oe(n.cssRules,t):t.push(n);return t}var xn=/\bx?link:?href\s*=\s*["'](?!data:)[^"']+["']/i;function En(e){return xn.test(e.innerHTML)}async function kn(e,t){let n=await Re(e,t);if(D(n.node)&&V(n.node)&&!En(n.node))return n.node;let{ownerDocument:r,log:o,tasks:i,svgStyleElement:s,svgDefsElement:a,svgStyles:c,font:u,progress:l,autoDestruct:m,onCloneNode:f,onEmbedNode:p,onCreateForeignObjectSvg:b}=n;o.time("clone node");let d=await se(n.node,n,!0);if(s&&r){let A="";c.forEach((F,P)=>{A+=`${F.join(`,
`)} {
  ${P}
}
`}),s.appendChild(r.createTextNode(A))}o.timeEnd("clone node"),await f?.(d),u!==!1&&D(d)&&(o.time("embed web font"),await hn(d,n),o.timeEnd("embed web font")),o.time("embed node"),He(d,n);let h=i.length,w=0,E=async()=>{for(;;){let A=i.pop();if(!A)break;try{await A}catch(F){n.log.warn("Failed to run task",F)}l?.(++w,h)}};l?.(w,h),await Promise.all([...Array.from({length:4})].map(E)),o.timeEnd("embed node"),await p?.(d);let k=Sn(d,n);return a&&k.insertBefore(a,k.children[0]),s&&k.insertBefore(s,k.children[0]),m&&ln(n),await b?.(k),k}function Sn(e,t){let{width:n,height:r}=t,o=$t(n,r,e.ownerDocument),i=o.ownerDocument.createElementNS(o.namespaceURI,"foreignObject");return i.setAttributeNS(null,"x","0%"),i.setAttributeNS(null,"y","0%"),i.setAttributeNS(null,"width","100%"),i.setAttributeNS(null,"height","100%"),i.append(e),o.appendChild(i),o}async function je(e,t){let n=await Re(e,t),r=await kn(n),o=Dt(r,n.isEnable("removeControlCharacter"));n.autoDestruct||(n.svgStyleElement=Fe(n.ownerDocument),n.svgDefsElement=n.ownerDocument?.createElementNS(Q,"defs"),n.svgStyles.clear());let i=H(o,r.ownerDocument);return await zt(i,n)}var Cn=2;function Tn(e){let t=Number.isFinite(e)&&e>0?e:1;return Math.min(t,Cn)}async function qe(e){try{let t=Tn(window.devicePixelRatio),n=await je(document.documentElement,{scale:t,backgroundColor:An(),timeout:15e3,filter:u=>!(e&&(u===e||e.contains(u)))}),r=Math.max(1,Math.round(window.innerWidth*t)),o=Math.max(1,Math.round(window.innerHeight*t)),i=document.createElement("canvas");i.width=r,i.height=o;let s=i.getContext("2d");if(!s)return null;let a=Math.round(window.scrollX*t),c=Math.round(window.scrollY*t);return s.drawImage(n,a,c,r,o,0,0,r,o),{canvas:i,width:r,height:o,scale:t}}catch(t){return console.debug("[prevly] screenshot failed",t),null}}function ze(e){return new Promise(t=>{try{e.toBlob(n=>t(n),"image/png")}catch{t(null)}})}function An(){try{let e=getComputedStyle(document.body).backgroundColor;if(e&&e!=="rgba(0, 0, 0, 0)"&&e!=="transparent")return e;let t=getComputedStyle(document.documentElement).backgroundColor;if(t&&t!=="rgba(0, 0, 0, 0)"&&t!=="transparent")return t}catch{}return"#ffffff"}var R="#e11d48",We=`
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
  contain: layout style;
}
:host([data-prevly-hidden]) { display: none !important; }
* { box-sizing: border-box; }
.root {
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
  color: #0f172a;
  -webkit-font-smoothing: antialiased;
}
.root button { font: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
.root button:focus-visible { outline: 2px solid ${R}; outline-offset: 2px; }

.launcher {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.launcher:hover { background: #1e293b; }
.launcher .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: ${R};
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.launcher .badge[hidden] { display: none; }

.menu {
  position: absolute;
  right: 16px;
  bottom: 76px;
  width: 292px;
  max-height: 60vh;
  overflow: auto;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
  padding: 6px;
  pointer-events: auto;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  text-align: left;
}
.menu-item:hover { background: #f1f5f9; }
.menu-item .hint { margin-left: auto; color: #64748b; font-size: 12px; }
.menu-sep { height: 1px; margin: 6px 4px; background: #e2e8f0; }
.menu-title { padding: 6px 10px 2px; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.menu-orphan { padding: 6px 10px; color: #475569; font-size: 12px; }
.menu-orphan b { color: #0f172a; font-weight: 600; }

.outline {
  position: absolute;
  border: 2px solid ${R};
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
  background: ${R};
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
  padding: 7px 14px;
  border-radius: 999px;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}

.pin {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: ${R};
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
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.2);
  pointer-events: auto;
}
.popover .who { font-weight: 600; }
.popover .when { color: #64748b; font-size: 11px; margin-left: 6px; }
.popover .body { margin-top: 6px; white-space: pre-wrap; word-break: break-word; }
.popover a { color: ${R}; font-size: 12px; display: inline-block; margin-top: 8px; }

.backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: auto;
}
.modal {
  width: min(900px, 100%);
  max-height: 100%;
  overflow: auto;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.4);
  padding: 16px;
}
.modal h2 { margin: 0 0 10px; font-size: 15px; font-weight: 600; }
.canvas-wrap {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  justify-content: center;
}
.canvas-wrap canvas {
  max-width: 100%;
  max-height: 46vh;
  width: auto;
  height: auto;
  display: block;
  cursor: crosshair;
  touch-action: none;
  border-radius: 6px;
}
.notice {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 12px;
}
.tools { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.tool {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-size: 12px;
}
.tool[aria-pressed="true"] { border-color: ${R}; color: ${R}; background: #fff1f2; }
.fields { display: grid; gap: 8px; }
.fields label { font-size: 12px; color: #475569; display: grid; gap: 4px; }
.fields textarea, .fields input {
  font: inherit;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #0f172a;
  background: #fff;
}
.fields textarea { min-height: 76px; resize: vertical; }
.fields textarea:focus, .fields input:focus { outline: 2px solid ${R}; outline-offset: 0; border-color: ${R}; }
.error { color: ${R}; font-size: 12px; min-height: 16px; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
.btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #fff;
  font-size: 13px;
}
.btn-primary { background: ${R}; border-color: ${R}; color: #fff; }
.btn[disabled] { opacity: .55; cursor: default; }

.toast {
  position: absolute;
  right: 16px;
  bottom: 76px;
  max-width: 320px;
  padding: 10px 14px;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.35);
  pointer-events: auto;
}
.toast a { color: #fda4af; margin-left: 6px; }
[hidden] { display: none !important; }
`;function Ye(e,t){let{shot:n}=t,r=[],o="rect",i=null,s=!1,a=v("canvas"),c=n?Math.max(2,Math.round(3*n.scale)):3;n&&(a.width=n.width,a.height=n.height);let u=y=>{if(n){if(y.clearRect(0,0,n.width,n.height),y.drawImage(n.canvas,0,0),y.save(),y.strokeStyle=R,y.fillStyle=R,y.lineWidth=c,y.lineCap="round",y.lineJoin="round",t.rect&&t.rect.w>0&&t.rect.h>0){let g=n.scale;y.strokeRect(t.rect.x*g,t.rect.y*g,t.rect.w*g,t.rect.h*g)}for(let g of r)Ve(y,g,c);i&&Ve(y,i,c),y.restore()}},l=()=>{let y=a.getContext("2d");y&&u(y)},m=y=>{let g=a.getBoundingClientRect(),T=g.width?a.width/g.width:1,N=g.height?a.height/g.height:1;return[(y.clientX-g.left)*T,(y.clientY-g.top)*N]},f=null;a.addEventListener("pointerdown",y=>{n&&(y.preventDefault(),a.setPointerCapture(y.pointerId),f=m(y),i=o==="pen"?{kind:"pen",pts:[f]}:o==="rect"?{kind:"rect",x:f[0],y:f[1],w:0,h:0}:{kind:"arrow",x1:f[0],y1:f[1],x2:f[0],y2:f[1]},l())}),a.addEventListener("pointermove",y=>{if(!i||!f)return;let[g,T]=m(y);i.kind==="pen"?i.pts.push([g,T]):i.kind==="rect"?(i.x=Math.min(f[0],g),i.y=Math.min(f[1],T),i.w=Math.abs(g-f[0]),i.h=Math.abs(T-f[1])):(i.x2=g,i.y2=T),l()});let p=()=>{i&&!Pn(i)&&r.push(i),i=null,f=null,l()};a.addEventListener("pointerup",p),a.addEventListener("pointercancel",p);let b=(y,g)=>v("button",{class:"tool",text:g,attrs:{type:"button","aria-label":`Tool: ${g}`,"aria-pressed":String(o===y)},on:{click:()=>{o=y;for(let[T,N]of d)T.setAttribute("aria-pressed",String(N===o))}}}),d=[];for(let[y,g]of[["rect","Rectangle"],["arrow","Arrow"],["pen","Pen"]])d.push([b(y,g),y]);let h=v("button",{class:"tool",text:"Undo",attrs:{type:"button","aria-label":"Undo the last drawing"},on:{click:()=>{r.pop(),l()}}}),w=v("button",{class:"tool",text:"Clear",attrs:{type:"button","aria-label":"Clear all drawings"},on:{click:()=>{r.length=0,l()}}}),E=v("textarea",{attrs:{"aria-label":"Comment",placeholder:"What is wrong on this element?",required:"required","data-prevly":"comment"}}),k=v("input",{attrs:{"aria-label":"Your name",placeholder:"Your name",required:"required","data-prevly":"author"}});k.value=t.author;let A=v("div",{class:"error",attrs:{role:"alert"}}),F=v("button",{class:"btn",text:"Cancel",attrs:{type:"button","aria-label":"Cancel this feedback"},on:{click:()=>t.onCancel()}}),P=v("button",{class:"btn btn-primary",text:"Send",attrs:{type:"button","aria-label":"Send this feedback","data-prevly":"send"},on:{click:()=>void x()}});async function x(){if(s)return;let y=E.value.trim(),g=k.value.trim();if(!y){A.textContent="A comment is required.",E.focus();return}if(!g){A.textContent="A name is required.",k.focus();return}s=!0,A.textContent="",P.setAttribute("disabled","disabled"),P.textContent="Sending\u2026";let T=null;if(n){let M=document.createElement("canvas");M.width=n.width,M.height=n.height;let U=M.getContext("2d");U&&(u(U),T=await ze(M))}let N=await t.onSubmit({comment:y,author:g,png:T});s=!1,P.removeAttribute("disabled"),P.textContent="Send",N&&(A.textContent=N)}let S=n?v("div",{class:"canvas-wrap"},a):v("div",{class:"notice",text:"The screenshot could not be captured on this page. You can still send the report without an image."}),C=v("div",{class:"modal",attrs:{role:"dialog","aria-modal":"true","aria-label":"New feedback"}},v("h2",{text:`Feedback on <${t.element.tag}>`}),S,n?v("div",{class:"tools"},...d.map(([y])=>y),h,w):null,v("div",{class:"fields"},v("label",{text:"Comment"},E),v("label",{text:"Your name"},k)),A,v("div",{class:"actions"},F,P)),I=v("div",{class:"backdrop",on:{pointerdown:y=>{y.target===I&&t.onCancel()}}},C);return e.append(I),l(),E.focus(),{close(){I.remove()}}}function Pn(e){return e.kind==="rect"?e.w<2&&e.h<2:e.kind==="arrow"?Math.hypot(e.x2-e.x1,e.y2-e.y1)<4:e.pts.length<2}function Ve(e,t,n){if(t.kind==="rect"){e.strokeRect(t.x,t.y,t.w,t.h);return}if(t.kind==="pen"){e.beginPath();let u=t.pts[0];if(!u)return;e.moveTo(u[0],u[1]);for(let l=1;l<t.pts.length;l+=1){let m=t.pts[l];m&&e.lineTo(m[0],m[1])}e.stroke();return}let{x1:r,y1:o,x2:i,y2:s}=t;e.beginPath(),e.moveTo(r,o),e.lineTo(i,s),e.stroke();let a=Math.atan2(s-o,i-r),c=Math.max(10,n*4);e.beginPath(),e.moveTo(i,s),e.lineTo(i-c*Math.cos(a-Math.PI/7),s-c*Math.sin(a-Math.PI/7)),e.lineTo(i-c*Math.cos(a+Math.PI/7),s-c*Math.sin(a+Math.PI/7)),e.closePath(),e.fill()}var L={author:80,comment:4e3,page:2e3,title:200,selector:500,elementText:120,userAgent:400,consoleEntries:20,consoleMessage:500};function $(e,t){return e.length<=t?e:e.slice(0,t)}function Z(e){return e.replace(/\s+/g," ").trim()}function Xe(e){let t={author:$(Z(e.author),L.author),comment:$(e.comment.trim(),L.comment),page:$(e.page,L.page),viewport:{w:Math.round(e.viewport.w),h:Math.round(e.viewport.h),dpr:Nn(e.viewport.dpr)},userAgent:$(e.userAgent??"",L.userAgent),console:Mn(e.console??[])},n=Z(e.title??"");n&&(t.title=$(n,L.title));let r=(e.selector??"").trim();return r&&(t.selector=$(r,L.selector)),e.element&&(t.element={tag:e.element.tag.toLowerCase(),text:$(Z(e.element.text),L.elementText)}),e.click&&(t.click={x:Math.round(e.click.x),y:Math.round(e.click.y)}),e.rect&&(t.rect={x:Math.round(e.rect.x),y:Math.round(e.rect.y),w:Math.round(e.rect.w),h:Math.round(e.rect.h)}),t}function Ge(e){return e.author?e.comment?e.page?null:"The page is unknown.":"A comment is required.":"A name is required."}function Mn(e){return e.slice(-L.consoleEntries).map(n=>({level:n.level,message:$(n.message,L.consoleMessage),at:n.at}))}function Nn(e){return Math.round(e*100)/100}var Ln=new Set(["role","name","aria-label","rel","href"]);function In(e,t){let n=Ln.has(e);n||(n=e.startsWith("data-")&&Y(e));let r=Y(t)&&t.length<100;return r||(r=t.startsWith("#")&&Y(t.slice(1))),n&&r}function Rn(e){return Y(e)}function Fn(e){return Y(e)}function $n(e){return!0}function Je(e,t){if(e.nodeType!==Node.ELEMENT_NODE)throw new Error("Can't generate CSS selector for non-element node type.");if(e.tagName.toLowerCase()==="html")return"html";let n={root:document.body,idName:Rn,className:Fn,tagName:$n,attr:In,timeoutMs:1e3,seedMinLength:3,optimizedMinLength:2,maxNumberOfPathChecks:1/0},r=new Date,o={...n,...t},i=Bn(o.root,n),s,a=0;for(let u of Dn(e,o,i)){if(new Date().getTime()-r.getTime()>o.timeoutMs||a>=o.maxNumberOfPathChecks){let m=_n(e,i);if(!m)throw new Error(`Timeout: Can't find a unique selector after ${o.timeoutMs}ms`);return X(m)}if(a++,ue(u,i)){s=u;break}}if(!s)throw new Error("Selector was not found.");let c=[...et(s,e,o,i,r)];return c.sort(le),c.length>0?X(c[0]):X(s)}function*Dn(e,t,n){let r=[],o=[],i=e,s=0;for(;i&&i!==n;){let a=Un(i,t);for(let c of a)c.level=s;if(r.push(a),i=i.parentElement,s++,o.push(...Ze(r)),s>=t.seedMinLength){o.sort(le);for(let c of o)yield c;o=[]}}o.sort(le);for(let a of o)yield a}function Y(e){if(/^[a-z\-]{3,}$/i.test(e)){let t=e.split(/-|[A-Z]/);for(let n of t)if(n.length<=2||/[^aeiou]{4,}/i.test(n))return!1;return!0}return!1}function Un(e,t){let n=[],r=e.getAttribute("id");r&&t.idName(r)&&n.push({name:"#"+CSS.escape(r),penalty:0});for(let s=0;s<e.classList.length;s++){let a=e.classList[s];t.className(a)&&n.push({name:"."+CSS.escape(a),penalty:1})}for(let s=0;s<e.attributes.length;s++){let a=e.attributes[s];t.attr(a.name,a.value)&&n.push({name:`[${CSS.escape(a.name)}="${CSS.escape(a.value)}"]`,penalty:2})}let o=e.tagName.toLowerCase();if(t.tagName(o)){n.push({name:o,penalty:5});let s=ce(e,o);s!==void 0&&n.push({name:Qe(o,s),penalty:10})}let i=ce(e);return i!==void 0&&n.push({name:On(o,i),penalty:50}),n}function X(e){let t=e[0],n=t.name;for(let r=1;r<e.length;r++){let o=e[r].level||0;t.level===o-1?n=`${e[r].name} > ${n}`:n=`${e[r].name} ${n}`,t=e[r]}return n}function Ke(e){return e.map(t=>t.penalty).reduce((t,n)=>t+n,0)}function le(e,t){return Ke(e)-Ke(t)}function ce(e,t){let n=e.parentNode;if(!n)return;let r=n.firstChild;if(!r)return;let o=0;for(;r&&(r.nodeType===Node.ELEMENT_NODE&&(t===void 0||r.tagName.toLowerCase()===t)&&o++,r!==e);)r=r.nextSibling;return o}function _n(e,t){let n=0,r=e,o=[];for(;r&&r!==t;){let i=r.tagName.toLowerCase(),s=ce(r,i);if(s===void 0)return;o.push({name:Qe(i,s),penalty:NaN,level:n}),r=r.parentElement,n++}if(ue(o,t))return o}function On(e,t){return e==="html"?"html":`${e}:nth-child(${t})`}function Qe(e,t){return e==="html"?"html":`${e}:nth-of-type(${t})`}function*Ze(e,t=[]){if(e.length>0)for(let n of e[0])yield*Ze(e.slice(1,e.length),t.concat(n));else yield t}function Bn(e,t){return e.nodeType===Node.DOCUMENT_NODE?e:e===t.root?e.ownerDocument:e}function ue(e,t){let n=X(e);switch(t.querySelectorAll(n).length){case 0:throw new Error(`Can't select any node with this selector: ${n}`);case 1:return!0;default:return!1}}function*et(e,t,n,r,o){if(e.length>2&&e.length>n.optimizedMinLength)for(let i=1;i<e.length-1;i++){if(new Date().getTime()-o.getTime()>n.timeoutMs)return;let a=[...e];a.splice(i,1),ue(a,r)&&r.querySelector(X(a))===t&&(yield a,yield*et(a,t,n,r,o))}}function nt(e,t=document){let n=t.body??t.documentElement,r=Hn(e,n);if(r&&tt(t,r,e))return $(r,L.selector);let o=jn(e);return o&&tt(t,o,e)?$(o,L.selector):null}function Hn(e,t){try{return Je(e,{root:t,timeoutMs:800,seedMinLength:2,optimizedMinLength:2})}catch{return null}}function jn(e){let t=[],n=e;for(;n;){let r=n.parentElement,o=n.tagName.toLowerCase();if(!r){t.unshift(o);break}let i=Array.prototype.indexOf.call(r.children,n)+1;if(t.unshift(`${o}:nth-child(${i})`),n=r,t.length>14)return null}return t.length?t.join(" > "):null}function tt(e,t,n){try{let r=e.querySelectorAll(t);return r.length===1&&r[0]===n}catch{return!1}}function ee(e){let t=(e.textContent??"").replace(/\s+/g," ").trim();return $(t,L.elementText)}function rt(e){let t=e.tagName.toLowerCase(),n=typeof e.className=="string"?e.className.trim().split(/\s+/)[0]:"",r=e.id?`#${e.id}`:"";return`${t}${r}${n?`.${n}`:""}`}var ot=["pointerdown","pointerup","mousedown","mouseup","click","contextmenu"];function it(e){let t=v("div",{class:"outline",attrs:{hidden:""}}),n=v("div",{class:"outline-label",attrs:{hidden:""}}),r=v("div",{class:"picker-hint",text:"Click the element to report \xB7 Esc to cancel",attrs:{hidden:""}});e.append(t,n,r);let o=!1,i=null,s=null,a=null,c="",u=(d,h)=>{let w=document.elementFromPoint(d,h);return!w||w===document.documentElement?null:w},l=d=>{let h=d.getBoundingClientRect();t.removeAttribute("hidden"),t.style.left=`${h.left}px`,t.style.top=`${h.top}px`,t.style.width=`${h.width}px`,t.style.height=`${h.height}px`;let w=ee(d);n.textContent=`${rt(d)}${w?` \u2014 ${w.slice(0,60)}`:""}`,n.removeAttribute("hidden");let E=h.top>=24;n.style.left=`${Math.max(4,Math.min(h.left,window.innerWidth-330))}px`,n.style.top=E?`${h.top-22}px`:`${Math.min(h.bottom+4,window.innerHeight-24)}px`},m=d=>{if(!o)return;let h=u(d.clientX,d.clientY);!h||h===i||(i=h,l(h))},f=()=>{o&&i&&l(i)},p=d=>{if(!o||(d.preventDefault(),d.stopPropagation(),d.type!=="click"))return;let h=d,w=u(h.clientX,h.clientY)??i;if(!w)return;let E=w.getBoundingClientRect(),k=s;b(),k?.({el:w,click:{x:h.clientX,y:h.clientY},rect:{x:E.left,y:E.top,w:E.width,h:E.height}})};function b(){if(o){o=!1,i=null,s=null,a=null,t.setAttribute("hidden",""),n.setAttribute("hidden",""),r.setAttribute("hidden",""),document.documentElement.style.cursor=c,document.removeEventListener("mousemove",m,!0),window.removeEventListener("scroll",f,!0),window.removeEventListener("resize",f,!0);for(let d of ot)document.removeEventListener(d,p,!0)}}return{isActive:()=>o,start(d,h){o&&b(),o=!0,s=d,a=h,c=document.documentElement.style.cursor,document.documentElement.style.cursor="crosshair",r.removeAttribute("hidden"),document.addEventListener("mousemove",m,!0),window.addEventListener("scroll",f,!0),window.addEventListener("resize",f,!0);for(let w of ot)document.addEventListener(w,p,!0)},cancel(){let d=a;b(),d?.()}}}function de(e){return`${e.pathname}${e.search}`}function qn(e,t){return e.filter(n=>n&&n.page===t).slice().sort(Wn)}function at(e,t,n,r){let o=[],i=[];return qn(e,t).forEach((s,a)=>{let c=a+1,u=s.selector?zn(n,s.selector):null;u&&(!r||!r.contains(u))?o.push({item:s,n:c,el:u}):i.push({item:s,n:c})}),{matched:o,orphans:i}}function zn(e,t){try{return e.querySelector(t)}catch{return null}}function Wn(e,t){let n=Date.parse(e.created_at??""),r=Date.parse(t.created_at??"");return Number.isFinite(n)&&Number.isFinite(r)&&n!==r?n-r:String(e.id??"").localeCompare(String(t.id??""))}function st(e,t=Date.now()){let n=Date.parse(e);if(!Number.isFinite(n))return"";let r=Math.max(0,Math.round((t-n)/1e3));return r<60?"just now":r<3600?`${Math.floor(r/60)} min ago`:r<86400?`${Math.floor(r/3600)} h ago`:r<30*86400?`${Math.floor(r/86400)} d ago`:new Date(n).toLocaleDateString()}function lt(e,t){let n=v("div",{class:"pin-container"});e.append(n);let r=[],o="",i=!0,s=[],a=[],c=new Map,u=null,l=!1,m=0,f=0,p=()=>{for(let x of s){let S=c.get(x.item.id);if(!S)continue;if(!x.el.isConnected){S.setAttribute("hidden","");continue}let C=x.el.getBoundingClientRect();if(C.bottom<-40||C.top>window.innerHeight+40||C.right<-40||C.left>window.innerWidth+40||C.width===0&&C.height===0){S.setAttribute("hidden","");continue}S.removeAttribute("hidden");let y=Math.min(Math.max(C.right-11,2),window.innerWidth-24),g=Math.min(Math.max(C.top-11,2),window.innerHeight-24);S.style.left=`${y}px`,S.style.top=`${g}px`}u&&A(u)},b=()=>{m||(m=requestAnimationFrame(()=>{m=0,i&&p()}))},d=()=>{let x=at(r,o,document,t);s=x.matched,a=x.orphans;let S=new Map;for(let C of s){let I=c.get(C.item.id),y=I??h(C);y.textContent=String(C.n),S.set(C.item.id,y),I||n.append(y)}for(let[C,I]of c)S.has(C)||I.remove();c=S,n.toggleAttribute("hidden",!i),i&&p()},h=x=>v("button",{class:"pin",attrs:{type:"button","aria-label":`Feedback ${x.n} from ${x.item.author}`,"data-prevly-pin":x.item.id},on:{click:S=>{S.stopPropagation(),E(x)},mouseenter:()=>{l||w(x)},mouseleave:()=>{l||k()}}}),w=x=>{k();let S=x.item,C=v("div",{class:"popover",attrs:{role:"dialog","aria-label":`Feedback ${x.n}`}},v("div",{},v("span",{class:"who",text:S.author}),v("span",{class:"when",text:st(S.created_at)})),v("div",{class:"body",text:S.comment}),S.comment_url?v("a",{text:"GitHub",attrs:{href:S.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null);C.dataset.pin=S.id,n.append(C),u=C,A(C)},E=x=>{if(l&&u?.dataset.pin===x.item.id){k();return}w(x),l=!0};function k(){u?.remove(),u=null,l=!1}function A(x){let S=x.dataset.pin,C=S?c.get(S):null;if(!C||C.hasAttribute("hidden")){k();return}let I=C.getBoundingClientRect(),y=x.offsetWidth||260,g=x.offsetHeight||120,T=Math.min(Math.max(I.left-y+22,8),window.innerWidth-y-8),N=I.top>g+12?I.top-g-8:I.bottom+8;x.style.left=`${T}px`,x.style.top=`${Math.min(N,window.innerHeight-g-8)}px`}let F=()=>{f&&clearTimeout(f),f=window.setTimeout(()=>{f=0,i&&d()},250)},P=new MutationObserver(F);return P.observe(document.documentElement,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["class","style","hidden"]}),window.addEventListener("scroll",b,!0),window.addEventListener("resize",b),{update(x,S){r=x,o=S,d()},orphans:()=>a,count:()=>s.length+a.length,setVisible(x){i=x,x||k(),n.toggleAttribute("hidden",!x),x&&d()},isVisible:()=>i,closePopover:k,destroy(){P.disconnect(),window.removeEventListener("scroll",b,!0),window.removeEventListener("resize",b),m&&cancelAnimationFrame(m),f&&clearTimeout(f),k(),n.remove()}}}function ct(e){let t=e.api??ye(),n=e.storage===void 0?Xn():e.storage,r=null,o=null,i=null,s=null,a=null,c=null,u=null,l=0,m=[];function f(){if(r)return;r=document.createElement("prevly-feedback");for(let[M,U]of[["position","fixed"],["inset","0"],["z-index","2147483647"],["pointer-events","none"],["display","block"]])r.style.setProperty(M,U,"important");let g=r.attachShadow({mode:"open"}),T=document.createElement("style");T.textContent=We,o=v("div",{class:"root"}),g.append(T,o);for(let M of["keydown","keyup","keypress"])r.addEventListener(M,U=>U.stopPropagation());u=v("span",{class:"badge",attrs:{hidden:""}});let N=v("button",{class:"launcher",attrs:{type:"button","aria-label":"Preview feedback","data-prevly":"launcher"},on:{click:M=>{M.stopPropagation(),d()}}},document.createTextNode("\u{1F4AC}"),u);o.append(N),s=it(o),i=lt(o,r),document.body.append(r),document.addEventListener("keydown",S,!0),document.addEventListener("pointerdown",C,!0),b()}function p(){document.removeEventListener("keydown",S,!0),document.removeEventListener("pointerdown",C,!0),s?.cancel(),a?.close(),a=null,i?.destroy(),i=null,s=null,c=null,u=null,o=null,l&&clearTimeout(l),r?.remove(),r=null}async function b(){if(m=await t.list(),!i||!o)return;i.update(m,de(location));let g=i.count();u&&(u.textContent=String(g),u.toggleAttribute("hidden",g===0)),c&&E()}function d(){c?w():h()}function h(){!o||c||(c=v("div",{class:"menu",attrs:{role:"menu","aria-label":"Preview feedback"}}),o.append(c),E())}function w(){c?.remove(),c=null}function E(){if(!c||!i)return;ve(c);let g=i.isVisible(),T=i.count();c.append(k("New feedback","Start a new feedback",()=>{w(),A()}),k(`Pins on this page (${T})`,"Toggle the pins on this page",()=>{i?.setVisible(!i.isVisible()),E()},g?"shown":"hidden"),k("Hide widget","Hide the feedback widget on this browser",()=>{B(n??Gn(),!1),p()}));let N=i.orphans();if(N.length){c.append(v("div",{class:"menu-sep"}),v("div",{class:"menu-title",text:"Element no longer on the page"}));for(let M of N)c.append(v("div",{class:"menu-orphan"},v("b",{text:`${M.n}. ${M.item.author}`}),document.createTextNode(` \xB7 ${Vn(M.item.comment)}`)))}}function k(g,T,N,M){return v("button",{class:"menu-item",attrs:{type:"button",role:"menuitem","aria-label":T},on:{click:()=>N()}},document.createTextNode(g),M?v("span",{class:"hint",text:M}):null)}function A(){s&&(i?.closePopover(),s.start(g=>void F(g),()=>{}))}async function F(g){let T=await P(()=>qe(r)),N=nt(g.el),M={tag:g.el.tagName.toLowerCase(),text:ee(g.el)};a=Ye(o,{shot:T,rect:g.rect,element:M,author:I(),onCancel:()=>{a?.close(),a=null},onSubmit:async({comment:U,author:fe,png:dt})=>{let me=Xe({author:fe,comment:U,page:de(location),title:document.title,selector:N,element:M,click:g.click,rect:g.rect,viewport:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1},userAgent:navigator.userAgent,console:e.recorder.entries()}),pe=Ge(me);if(pe)return pe;let O=await t.submit(me,dt);if(!O.ok){if(O.kind==="rate-limit"){let ge=O.retryAfter;return ge?`${O.message} (retry in ${ge}s)`:O.message}return O.message}return y(fe),a?.close(),a=null,x(O.item),b(),null}})}async function P(g){r?.setAttribute("data-prevly-hidden",""),r&&r.style.setProperty("display","none","important"),await Yn();try{return await g()}finally{r?.removeAttribute("data-prevly-hidden"),r&&r.style.setProperty("display","block","important")}}function x(g){if(!o)return;l&&clearTimeout(l),o.querySelector(".toast")?.remove();let T=v("div",{class:"toast",attrs:{role:"status","data-prevly":"toast"}},document.createTextNode(g.comment_url?"Sent \xB7":"Sent, comment pending"),g.comment_url?v("a",{text:"open on GitHub",attrs:{href:g.comment_url,target:"_blank",rel:"noreferrer noopener"}}):null);o.append(T),l=window.setTimeout(()=>{T.remove(),l=0},9e3)}function S(g){if(g.key==="Escape"){if(a)a.close(),a=null;else if(s?.isActive())s.cancel();else if(c)w();else{i?.closePopover();return}g.preventDefault(),g.stopPropagation()}}function C(g){if(!c||!r)return;let T=g.composedPath();T.includes(c)||T.includes(r)||w()}function I(){try{return n?.getItem(ne)??""}catch{return""}}function y(g){try{n?.setItem(ne,g)}catch{}}return{mount:f,unmount:p,open(){f(),h()},isMounted:()=>r!==null}}function Vn(e){let t=e.replace(/\s+/g," ").trim();return t.length>70?`${t.slice(0,70)}\u2026`:t}function Yn(){return new Promise(e=>{requestAnimationFrame(()=>requestAnimationFrame(()=>e()))})}function Xn(){try{return window.localStorage}catch{return null}}function Gn(){let e=new Map;return{get length(){return e.size},clear:()=>e.clear(),getItem:t=>e.get(t)??null,key:t=>Array.from(e.keys())[t]??null,removeItem:t=>void e.delete(t),setItem:(t,n)=>void e.set(t,n)}}function Kn(e){let t=[];for(let n of e)t.push(Jn(n));return t.join(" ")}function Jn(e){if(typeof e=="string")return e;if(e instanceof Error)return`${e.name}: ${e.message}`;if(e===null)return"null";if(e===void 0)return"undefined";if(typeof e=="object")try{return JSON.stringify(e)??String(e)}catch{return Qn(e)}try{return String(e)}catch{return"[unprintable]"}}function Qn(e){let t=e.constructor?.name;return t?`[object ${t}]`:"[object]"}function ut(e={}){let t=e.limit??L.consoleEntries,n=e.maxMessage??L.consoleMessage,r=e.console??(typeof console<"u"?console:void 0),o=e.target===void 0?typeof window<"u"?window:null:e.target,i=e.now??(()=>new Date),s=[],a=(u,l)=>{try{let m=Kn(l);if(!m)return;for(s.push({level:u,message:m.length<=n?m:m.slice(0,n),at:i().toISOString()});s.length>t;)s.shift()}catch{}},c=[];if(r)for(let u of["error","warn"]){let l=r[u];if(typeof l!="function")continue;let m=function(...p){try{l.apply(this??r,p)}finally{a(u,p)}};r[u]=m,c.push(()=>{r[u]=l})}if(o){let u=m=>{let f=m,p=f.error;!p&&!f.message||a("error",[p instanceof Error?p:f.message])},l=m=>{let f=m.reason;a("error",["Unhandled rejection:",f])};try{o.addEventListener("error",u),o.addEventListener("unhandledrejection",l),c.push(()=>{o.removeEventListener("error",u),o.removeEventListener("unhandledrejection",l)})}catch{}}return{entries:()=>s.slice(),record:a,stop:()=>{for(;c.length;){let u=c.pop();try{u?.()}catch{}}}}}function Zn(){let e=ut(),t=tr(),n=be(location.href);if(n.requested&&(t&&B(t,!0),n.cleanedUrl))try{history.replaceState(history.state,"",n.cleanedUrl)}catch{}let r=ct({recorder:e,storage:t});window.__prevlyFeedback={open(){try{t&&B(t,!0),r.open()}catch(o){console.debug("[prevly] feedback open failed",o)}},hide(){try{t&&B(t,!1),r.unmount()}catch(o){console.debug("[prevly] feedback hide failed",o)}}},!(!t||!we(t))&&er(()=>{try{r.mount()}catch(o){console.debug("[prevly] feedback mount failed",o)}})}function er(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}function tr(){try{return window.localStorage}catch{return null}}try{Zn()}catch(e){console.debug("[prevly] feedback widget failed to start",e)}})();
