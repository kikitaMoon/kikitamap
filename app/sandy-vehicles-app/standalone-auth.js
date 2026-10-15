const config = {"mode":"public"};
const moduleIds = {"identityManager":"@arcgis/core/identity/IdentityManager.js","oauthInfo":"@arcgis/core/identity/OAuthInfo.js","config":"@arcgis/core/config.js"};

function showFailure(error) {
  const node = document.getElementById('app-error');
  if (!node) return;
  node.hidden = false;
  node.textContent = error instanceof Error ? error.message : String(error);
}

async function start() {
  if (config.mode === 'public') {
    await import('./app.js');
    return;
  }
  const loader = globalThis.$arcgis;
  if (!loader || typeof loader.import !== 'function') {
    throw new Error('The ArcGIS module loader is unavailable.');
  }
  const [IdentityManager, OAuthInfo, esriConfig] = await Promise.all([
    loader.import(moduleIds.identityManager),
    loader.import(moduleIds.oauthInfo),
    loader.import(moduleIds.config),
  ]);
  esriConfig.portalUrl = config.portalUrl;
  IdentityManager.registerOAuthInfos([
    new OAuthInfo({
      appId: config.appId,
      portalUrl: config.portalUrl,
      redirectUri: config.redirectUri,
      popup: false,
    }),
  ]);
  const sharingUrl = config.portalUrl.replace(/\/+$/, '') + '/sharing';
  try {
    await IdentityManager.checkSignInStatus(sharingUrl);
  } catch {
    const node = document.getElementById('app-error');
    if (!node) throw new Error('Sign in is required to open this app.');
    node.hidden = false;
    node.textContent = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Sign in to open this app';
    button.addEventListener('click', () => {
      void IdentityManager.getCredential(sharingUrl).then(
        () => location.reload(),
        showFailure,
      );
    });
    node.appendChild(button);
    return;
  }
  await import('./app.js');
}

void start().catch(showFailure);
