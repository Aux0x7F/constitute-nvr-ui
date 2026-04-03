(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))r(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const _="constitute.app.launch",V="constitute.launch.",D=6e3,F=3e4,R=document.querySelector("#app");if(!R)throw new Error("#app not found");R.innerHTML=`
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Constitute Managed App</p>
        <h1>Security Cameras</h1>
        <p id="subtitle" class="subtitle">Waiting for managed launch context…</p>
      </div>
      <div class="heroMeta">
        <span id="connectionBadge" class="badge badge-neutral">idle</span>
        <a id="backLink" class="backLink" href="/constitute/">Back to Shell</a>
      </div>
    </header>

    <section class="panel summaryPanel">
      <div class="summaryItem">
        <span class="summaryLabel">Gateway</span>
        <span id="summaryGateway" class="summaryValue mono">—</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">Service</span>
        <span id="summaryService" class="summaryValue mono">—</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">Cameras</span>
        <span id="summaryCameras" class="summaryValue">0</span>
      </div>
      <div class="summaryItem">
        <span class="summaryLabel">State</span>
        <span id="summaryState" class="summaryValue">waiting</span>
      </div>
    </section>

    <section class="panel">
      <div class="panelHeader">
        <div>
          <h2>Live Grid</h2>
          <p id="gridHint" class="panelHint">Launch context not loaded yet.</p>
        </div>
        <button id="btnReconnect" type="button" class="secondary">Reconnect</button>
      </div>
      <div id="cameraGrid" class="cameraGrid">
        <article class="emptyState">
          <strong>No Cameras</strong>
          <p>Launch the app from Constitute after the NVR service is available.</p>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panelHeader">
        <div>
          <h2>Session Log</h2>
          <p class="panelHint">Managed launch and WebRTC negotiation details.</p>
        </div>
      </div>
      <pre id="log" class="log"></pre>
    </section>
  </main>
`;const A=u("subtitle"),I=u("connectionBadge"),W=u("backLink"),j=u("summaryGateway"),z=u("summaryService"),K=u("summaryCameras"),Q=u("summaryState"),S=u("gridHint"),C=u("cameraGrid"),J=u("btnReconnect"),h=u("log"),E=new Map,L=new Map,y=new Map;let f=null,l=null,c=null,b=[];J.addEventListener("click",()=>{q()});function u(t){const e=document.getElementById(t);if(!e)throw new Error(`missing element #${t}`);return e}function g(t){const e=`[${new Date().toLocaleTimeString()}] ${t}`;h.textContent=h.textContent?`${h.textContent}
${e}`:e,h.scrollTop=h.scrollHeight}function d(t,e){I.textContent=t,I.className=`badge badge-${e}`}function m(t){Q.textContent=t}function x(t){const e=String(t||"").trim();return e?e.length>16?`${e.slice(0,16)}…`:e:"—"}function M(t){const e=new Uint8Array(12);crypto.getRandomValues(e);const n=Array.from(e,r=>r.toString(16).padStart(2,"0")).join("");return`${t}-${n}`}function X(){const t=String(window.location.hash||"").replace(/^#/,""),e=new URLSearchParams(t);return String(e.get("launch")||t||"").trim()}function Y(){return new URL("/constitute/",window.location.origin).toString()}function Z(t){return`${V}${t}`}function ee(t){const e=Z(t);try{const n=localStorage.getItem(e);if(!n)return null;const r=JSON.parse(n),a=Number((r==null?void 0:r.expiresAt)||0);return a&&a<Date.now()?(localStorage.removeItem(e),null):r}catch{return null}}function $(){if(f)return f;if(typeof BroadcastChannel>"u")throw new Error("BroadcastChannel is not available in this browser");return f=new BroadcastChannel(_),f.onmessage=t=>te(t.data),f}function te(t){if(!t||typeof t!="object")return;const e=t,n=String(e.type||"").trim();if(n==="launch-context.response"){const r=String(e.launchId||"").trim(),a=E.get(r);if(!a)return;if(clearTimeout(a.timer),E.delete(r),!(e.ok===!0)){a.resolve(null);return}a.resolve(e.context||null);return}if(n==="gateway.signal.response"){const r=String(e.requestId||"").trim(),a=L.get(r);if(!a)return;if(clearTimeout(a.timer),L.delete(r),!(e.ok===!0)){a.reject(new Error(String(e.error||"gateway signaling failed")));return}a.resolve({requestId:r,ok:!0,result:e.result})}}async function ne(t){const e=$(),n=new Promise((r,a)=>{const o=window.setTimeout(()=>{E.delete(t),a(new Error("launch context request timed out"))},D);E.set(t,{resolve:r,reject:a,timer:o})});return e.postMessage({type:"launch-context.request",launchId:t}),await n}async function ae(t,e){if(!l)throw new Error("launch context is not loaded");const n=$(),r=M("nvr-signal"),a=new Promise((o,i)=>{const p=window.setTimeout(()=>{L.delete(r),i(new Error(`${t} signaling timed out`))},F);L.set(r,{resolve:o,reject:i,timer:p})});return n.postMessage({type:"gateway.signal.request",launchId:l.launchId,requestId:r,signalType:t,payload:e}),await a}function v(t){if(!Array.isArray(t))return[];const e=[];for(const n of t){const r=String(n||"").trim();r&&!e.includes(r)&&e.push(r)}return e}function re(t){const e=[],n=v((t==null?void 0:t.stun)||[]);n.length>0&&e.push({urls:n});const r=v((t==null?void 0:t.turn)||[]);return r.length>0&&e.push({urls:r}),e}function P(t,e){y.clear(),C.innerHTML=`
    <article class="emptyState">
      <strong>${N(t)}</strong>
      <p>${N(e)}</p>
    </article>
  `}function T(t){const e=y.get(t);if(e)return e;y.size===0&&(C.innerHTML="");const n=document.createElement("article");n.className="cameraTile";const r=document.createElement("div");r.className="cameraHeader";const a=document.createElement("div");a.className="cameraTitle",a.textContent=t;const o=document.createElement("span");o.className="cameraBadge cameraBadge-neutral",o.textContent="waiting",r.appendChild(a),r.appendChild(o);const i=document.createElement("video");i.className="cameraVideo",i.autoplay=!0,i.muted=!0,i.playsInline=!0,i.controls=!1;const p=document.createElement("p");p.className="cameraDetail",p.textContent="Waiting for media.",n.appendChild(r),n.appendChild(i),n.appendChild(p),C.appendChild(n);const s={id:t,card:n,badge:o,detail:p,video:i};return y.set(t,s),s}function w(t,e,n){const r=T(t);r.badge.textContent=e,r.badge.className=`cameraBadge cameraBadge-${e}`,r.detail.textContent=n}function oe(t,e){const n=T(t);n.video.srcObject=e,n.video.play().catch(()=>{}),w(t,"live","Receiving live preview.")}function k(t,e){for(const n of y.keys())w(n,t,e)}function N(t){return String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function se(t,e=8e3){t.iceGatheringState!=="complete"&&await new Promise(n=>{const r=window.setTimeout(()=>{t.removeEventListener("icegatheringstatechange",a),n()},e),a=()=>{t.iceGatheringState==="complete"&&(window.clearTimeout(r),t.removeEventListener("icegatheringstatechange",a),n())};t.addEventListener("icegatheringstatechange",a)})}function ce(t){const e=t.localDescription;if(!(e!=null&&e.type)||!e.sdp)throw new Error("local WebRTC offer is missing");return{type:e.type,sdp:e.sdp}}function ie(t){const e=t.result||{},n=e.payload||e.result||e,r=n&&typeof n=="object"?n:{},a=r.answer||r.payload||r.description||r,o=String((a==null?void 0:a.type)||"").trim(),i=String((a==null?void 0:a.sdp)||"").trim();if(!o||!i)throw new Error("gateway answer payload is missing type/sdp");return{type:o,sdp:i}}function le(t,e){const n=t.result||{},r=n.payload||n.result||n,a=v(r==null?void 0:r.sources);return a.length>0?a:e}function G(t){const e=t.display||{};A.textContent=e.serviceLabel?`Gateway-managed live preview for ${e.serviceLabel}.`:"Gateway-managed live preview for your Security Cameras service.",j.textContent=x(t.gatewayPk),z.textContent=x(t.servicePk),K.textContent=String(e.cameraCount||e.configuredSources||v(e.sources).length||0),W.href=Y()}async function H(){const t=X();if(!t)throw new Error("launch id is missing from the URL");const e=ee(t);if(e)return e;g(`launch context ${t} not found locally; asking shell`);const n=await ne(t);if(n)return n;throw new Error("launch context is unavailable; reopen this app from Constitute")}function ue(t){const e=c;if(!e)return"";const n=e.getTransceivers().indexOf(t.transceiver);return n>=0&&n<b.length?b[n]:b[0]||""}async function de(t){const e=t.display||{},n=v(e.sources);if(n.length===0){P("No Cameras","The managed NVR service has not reported any enabled sources yet."),d("no cameras","warn"),m("no cameras"),S.textContent="No enabled camera sources were advertised by the NVR service.";return}C.innerHTML="",y.clear();for(const s of n)T(s),w(s,"connecting","Preparing WebRTC preview…");S.textContent="Negotiating live preview through the owned gateway.",d("negotiating","warn"),m("negotiating");const r={iceServers:re(e.iceServers),bundlePolicy:"max-bundle"};c==null||c.close(),c=new RTCPeerConnection(r),b=[...n];for(const s of n)c.addTransceiver("video",{direction:"recvonly"}),w(s,"connecting","Waiting for answer from the gateway.");c.addEventListener("track",s=>{const O=ue(s),U=s.streams[0]||new MediaStream([s.track]);oe(O||s.track.id,U),d("live","good"),m("live"),S.textContent="Receiving live H.264 preview."}),c.addEventListener("connectionstatechange",()=>{const s=(c==null?void 0:c.connectionState)||"unknown";g(`peer connection state -> ${s}`),(s==="failed"||s==="disconnected")&&(d(s,"bad"),m(s),k("unavailable","Peer connection dropped."))}),c.addEventListener("iceconnectionstatechange",()=>{const s=(c==null?void 0:c.iceConnectionState)||"unknown";g(`ice connection state -> ${s}`),s==="checking"?(d("checking","warn"),m("checking")):s==="connected"||s==="completed"?(d("connected","good"),m("connected")):s==="failed"&&(d("failed","bad"),m("failed"),k("unavailable","ICE connectivity failed."))});const a=await c.createOffer();await c.setLocalDescription(a),await se(c),g(`sending offer for ${n.length} source(s)`);const o=await ae("offer",{description:ce(c),sourceIds:n}),i=le(o,n);for(const s of n)i.includes(s)||w(s,"unavailable","Source was not granted by the NVR service.");const p=ie(o);await c.setRemoteDescription(p),g("remote answer applied"),d("connecting","warn"),m("connecting")}async function q(){l||(l=await H()),G(l),await de(l)}function B(){if(c){try{c.close()}catch{}c=null}}function me(){if(!(!l||!f))try{f.postMessage({type:"gateway.signal.request",launchId:l.launchId,requestId:M("nvr-close"),signalType:"session_close",payload:{reason:"page_unload"}})}catch{}}window.addEventListener("beforeunload",()=>{me(),B()});async function pe(){d("loading","neutral"),m("loading"),g("bootstrapping managed NVR app surface"),l=await H(),g(`launch context loaded for service ${x(l.servicePk)}`),G(l),await q()}pe().catch(t=>{console.error(t),B(),d("error","bad"),m("error");const e=String((t==null?void 0:t.message)||t||"Unknown error");A.textContent="Managed launch failed.",S.textContent=e,P("Launch Failed",e),g(`fatal: ${e}`)});
