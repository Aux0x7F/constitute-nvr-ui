(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))r(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const _="constitute.app.launch",V="constitute.launch.",D=6e3,F=3e4,R=document.querySelector("#app");if(!R)throw new Error("#app not found");R.innerHTML=`
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
`;const A=u("subtitle"),I=u("connectionBadge"),W=u("backLink"),j=u("summaryGateway"),z=u("summaryService"),K=u("summaryCameras"),Q=u("summaryState"),S=u("gridHint"),C=u("cameraGrid"),J=u("btnReconnect"),h=u("log"),L=new Map,E=new Map,y=new Map;let f=null,l=null,i=null,b=[];J.addEventListener("click",()=>{q()});function u(e){const t=document.getElementById(e);if(!t)throw new Error(`missing element #${e}`);return t}function g(e){const t=`[${new Date().toLocaleTimeString()}] ${e}`;h.textContent=h.textContent?`${h.textContent}
${t}`:t,h.scrollTop=h.scrollHeight}function d(e,t){I.textContent=e,I.className=`badge badge-${t}`}function m(e){Q.textContent=e}function x(e){const t=String(e||"").trim();return t?t.length>16?`${t.slice(0,16)}…`:t:"—"}function M(e){const t=new Uint8Array(12);crypto.getRandomValues(t);const n=Array.from(t,r=>r.toString(16).padStart(2,"0")).join("");return`${e}-${n}`}function X(){const e=String(window.location.hash||"").replace(/^#/,""),t=new URLSearchParams(e);return String(t.get("launch")||e||"").trim()}function Y(){return new URL("/constitute/",window.location.origin).toString()}function Z(e){return`${V}${e}`}function ee(e){const t=Z(e);try{const n=localStorage.getItem(t);if(!n)return null;const r=JSON.parse(n),a=Number((r==null?void 0:r.expiresAt)||0);return a&&a<Date.now()?(localStorage.removeItem(t),null):r}catch{return null}}function $(){if(f)return f;if(typeof BroadcastChannel>"u")throw new Error("BroadcastChannel is not available in this browser");return f=new BroadcastChannel(_),f.onmessage=e=>te(e.data),f}function te(e){if(!e||typeof e!="object")return;const t=e,n=String(t.type||"").trim();if(n==="launch-context.response"){const r=String(t.launchId||"").trim(),a=L.get(r);if(!a)return;if(clearTimeout(a.timer),L.delete(r),!(t.ok===!0)){a.resolve(null);return}a.resolve(t.context||null);return}if(n==="gateway.signal.response"){const r=String(t.requestId||"").trim(),a=E.get(r);if(!a)return;if(clearTimeout(a.timer),E.delete(r),!(t.ok===!0)){a.reject(new Error(String(t.error||"gateway signaling failed")));return}a.resolve({requestId:r,ok:!0,result:t.result})}}async function ne(e){const t=$(),n=new Promise((r,a)=>{const o=window.setTimeout(()=>{L.delete(e),a(new Error("launch context request timed out"))},D);L.set(e,{resolve:r,reject:a,timer:o})});return t.postMessage({type:"launch-context.request",launchId:e}),await n}async function ae(e,t){if(!l)throw new Error("launch context is not loaded");const n=$(),r=M("nvr-signal"),a=new Promise((o,c)=>{const p=window.setTimeout(()=>{E.delete(r),c(new Error(`${e} signaling timed out`))},F);E.set(r,{resolve:o,reject:c,timer:p})});return n.postMessage({type:"gateway.signal.request",launchId:l.launchId,requestId:r,signalType:e,payload:t}),await a}function v(e){if(!Array.isArray(e))return[];const t=[];for(const n of e){const r=String(n||"").trim();r&&!t.includes(r)&&t.push(r)}return t}function re(e){const t=[],n=v((e==null?void 0:e.stun)||[]);n.length>0&&t.push({urls:n});const r=v((e==null?void 0:e.turn)||[]);return r.length>0&&t.push({urls:r}),t}function P(e,t){y.clear(),C.innerHTML=`
    <article class="emptyState">
      <strong>${N(e)}</strong>
      <p>${N(t)}</p>
    </article>
  `}function T(e){const t=y.get(e);if(t)return t;y.size===0&&(C.innerHTML="");const n=document.createElement("article");n.className="cameraTile";const r=document.createElement("div");r.className="cameraHeader";const a=document.createElement("div");a.className="cameraTitle",a.textContent=e;const o=document.createElement("span");o.className="cameraBadge cameraBadge-neutral",o.textContent="waiting",r.appendChild(a),r.appendChild(o);const c=document.createElement("video");c.className="cameraVideo",c.autoplay=!0,c.muted=!0,c.playsInline=!0,c.controls=!1;const p=document.createElement("p");p.className="cameraDetail",p.textContent="Waiting for media.",n.appendChild(r),n.appendChild(c),n.appendChild(p),C.appendChild(n);const s={id:e,card:n,badge:o,detail:p,video:c};return y.set(e,s),s}function w(e,t,n){const r=T(e);r.badge.textContent=t,r.badge.className=`cameraBadge cameraBadge-${t}`,r.detail.textContent=n}function oe(e,t){const n=T(e);n.video.srcObject=t,n.video.play().catch(()=>{}),w(e,"live","Receiving live preview.")}function k(e,t){for(const n of y.keys())w(n,e,t)}function se(){for(const e of y.values())if(e.badge.textContent==="live")return!0;return!1}function N(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}async function ie(e,t=8e3){e.iceGatheringState!=="complete"&&await new Promise(n=>{const r=window.setTimeout(()=>{e.removeEventListener("icegatheringstatechange",a),n()},t),a=()=>{e.iceGatheringState==="complete"&&(window.clearTimeout(r),e.removeEventListener("icegatheringstatechange",a),n())};e.addEventListener("icegatheringstatechange",a)})}function ce(e){const t=e.localDescription;if(!(t!=null&&t.type)||!t.sdp)throw new Error("local WebRTC offer is missing");return{type:t.type,sdp:t.sdp}}function le(e){const t=e.result||{},n=t.payload||t.result||t,r=n&&typeof n=="object"?n:{},a=r.answer||r.payload||r.description||r,o=String((a==null?void 0:a.type)||"").trim(),c=String((a==null?void 0:a.sdp)||"").trim();if(!o||!c)throw new Error("gateway answer payload is missing type/sdp");return{type:o,sdp:c}}function ue(e,t){const n=e.result||{},r=n.payload||n.result||n,a=v(r==null?void 0:r.sources);return a.length>0?a:t}function G(e){const t=e.display||{};A.textContent=t.serviceLabel?`Gateway-managed live preview for ${t.serviceLabel}.`:"Gateway-managed live preview for your Security Cameras service.",j.textContent=x(e.gatewayPk),z.textContent=x(e.servicePk),K.textContent=String(t.cameraCount||t.configuredSources||v(t.sources).length||0),W.href=Y()}async function H(){const e=X();if(!e)throw new Error("launch id is missing from the URL");const t=ee(e);if(t)return t;g(`launch context ${e} not found locally; asking shell`);const n=await ne(e);if(n)return n;throw new Error("launch context is unavailable; reopen this app from Constitute")}function de(e){const t=i;if(!t)return"";const n=t.getTransceivers().indexOf(e.transceiver);return n>=0&&n<b.length?b[n]:b[0]||""}async function me(e){const t=e.display||{},n=v(t.sources);if(n.length===0){P("No Cameras","The managed NVR service has not reported any enabled sources yet."),d("no cameras","warn"),m("no cameras"),S.textContent="No enabled camera sources were advertised by the NVR service.";return}C.innerHTML="",y.clear();for(const s of n)T(s),w(s,"connecting","Preparing WebRTC preview…");S.textContent="Negotiating live preview through the owned gateway.",d("negotiating","warn"),m("negotiating");const r={iceServers:re(t.iceServers),bundlePolicy:"max-bundle"};i==null||i.close(),i=new RTCPeerConnection(r),b=[...n];for(const s of n)i.addTransceiver("video",{direction:"recvonly"}),w(s,"connecting","Waiting for answer from the gateway.");i.addEventListener("track",s=>{const O=de(s),U=s.streams[0]||new MediaStream([s.track]);oe(O||s.track.id,U),d("live","good"),m("live"),S.textContent="Receiving live H.264 preview."}),i.addEventListener("connectionstatechange",()=>{const s=(i==null?void 0:i.connectionState)||"unknown";g(`peer connection state -> ${s}`),(s==="failed"||s==="disconnected")&&(d(s,"bad"),m(s),k("unavailable","Peer connection dropped."))}),i.addEventListener("iceconnectionstatechange",()=>{const s=(i==null?void 0:i.iceConnectionState)||"unknown";g(`ice connection state -> ${s}`),s==="checking"?(d("checking","warn"),m("checking")):s==="connected"||s==="completed"?(d("connected","good"),m("connected")):s==="failed"&&(d("failed","bad"),m("failed"),k("unavailable","ICE connectivity failed."))});const a=await i.createOffer();await i.setLocalDescription(a),await ie(i),g(`sending offer for ${n.length} source(s)`);const o=await ae("offer",{description:ce(i),sourceIds:n}),c=ue(o,n);for(const s of n)c.includes(s)||w(s,"unavailable","Source was not granted by the NVR service.");const p=le(o);await i.setRemoteDescription(p),g("remote answer applied"),se()||(d("connecting","warn"),m("connecting"))}async function q(){l||(l=await H()),G(l),await me(l)}function B(){if(i){try{i.close()}catch{}i=null}}function pe(){if(!(!l||!f))try{f.postMessage({type:"gateway.signal.request",launchId:l.launchId,requestId:M("nvr-close"),signalType:"session_close",payload:{reason:"page_unload"}})}catch{}}window.addEventListener("beforeunload",()=>{pe(),B()});async function ge(){d("loading","neutral"),m("loading"),g("bootstrapping managed NVR app surface"),l=await H(),g(`launch context loaded for service ${x(l.servicePk)}`),G(l),await q()}ge().catch(e=>{console.error(e),B(),d("error","bad"),m("error");const t=String((e==null?void 0:e.message)||e||"Unknown error");A.textContent="Managed launch failed.",S.textContent=t,P("Launch Failed",t),g(`fatal: ${t}`)});
