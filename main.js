/* global nacl */ /* yes, it passes jshint (without strict mode) */
var container = document.getElementsByClassName('semana-card-wide')[0];
var adminLink = document.getElementsByClassName('semana-admin-link')[0];
var doLoginForm = document.getElementsByClassName('semana-admin-area')[0];
var doLoginBtn = document.getElementById('doLogin');

var websiteSalt = nacl.util.decodeUTF8('segunda-semana');

function typedConcat() {
  var i;
  var result;
  var totalLength = 0;

  for (i = 0; i < arguments.length; i++) {
    totalLength += arguments[i].length;
  }

  result = new Uint8Array(totalLength);
  totalLength = 0; // reuse

  for (i = 0; i < arguments.length; i++) {
    result.set(arguments[i], totalLength);
    totalLength += arguments[i].length;
  }

  return result;
}

function generateKeyPair(user, pass) {
  var hash = new Uint8Array([]);
  // People expect that the user is normalized
  user = nacl.util.decodeUTF8(user.toLowerCase());
  pass = nacl.util.decodeUTF8(pass);

  var userData = typedConcat(
    user,
    websiteSalt,
    pass
  );

  // Target devices are smartphones, so the small loop count.
  // By the way, no one will ever try to break this.
  // >> IF YOU FORK THIS CODE AGREE WITH THE ABOVE OR INCREASE LOOP COUNT <<
  for (var i = 0; i < 500; i++) {
    hash = nacl.hash(typedConcat(
      userData,
      hash,
      userData
    ));
  }

  return hash.slice(0, 32);
}

adminLink.addEventListener('click', accessAdminArea);

function accessAdminArea(evt) {
  if (evt && evt.preventDefault) {evt.preventDefault();}
  document.getElementsByClassName('semana-admin-area')[0].classList
    .toggle('semana-admin-area_hidden');
  container.classList.toggle('semana-card-wide_hidden');
}

var credentials;
var user = '';
if (localStorage.credentials) {
  doLoginBtn.textContent = 'Atualizar credenciais';
  var parts = localStorage.credentials.split('!');
  doLogin(parts[0], nacl.util.decodeBase64(parts[1]));
}

function doLogin(userInput, password) {
  user = userInput;
  credentials = nacl.sign.keyPair.fromSeed(password);
}

doLoginForm.addEventListener('submit', function (evt) {
  evt.preventDefault();
  accessAdminArea();
  var user = document.getElementById('user').value.trim();
  var passEl = document.getElementById('pass');
  var seed = generateKeyPair(user, passEl.value);
  passEl.value = '';

  localStorage.credentials = user + '!' + nacl.util.encodeBase64(seed);
  doLogin(user, seed);
  afterLogged();
});

if (navigator.serviceWorker) {
  navigator.serviceWorker.register('sw.js', {
    scope: '.'
  });
} else {
  // AppCache fallback
  var iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-100%';
  iframe.style.height = '1px';
  iframe.src = 'offline.html';
  iframe.addEventListener('load', function () {
    document.body.removeChild(iframe);  
  });
  document.body.appendChild(iframe);
}

var data = [];
var currentId = location.href.match(/aluno=(\d+)/);

if (currentId) {
  data.push({
    id: currentId[1],
    hora: new Date().toISOString()
  });
}

if (localStorage.offlineData) {
  try {
    data = data.concat(JSON.parse(localStorage.offlineData));
  } catch (e) {}
  localStorage.offlineData = '';
}

data = data.filter(function(e){return e;});

if (user) {
  afterLogged();
} else {
  accessAdminArea();
}

function afterLogged() {
  if (location.hash === '#signup') {
    showResult({
      titulo: 'Registro de responsável',
      mensagem: 'Adicione o seguinte linha a planilha de responsaveis: "' + user +
        '", "' + nacl.util.encodeBase64(credentials.publicKey) + '" (sem as aspas)'
    });
    container.classList.add('semana-card-wide_signup');
  } else {
    loop();
  }
}

function loop() {
  var el = data.shift(); if (!el) {return;}
  
  var callbackName = 'callback_' + Date.now();
  
  showResult({titulo: 'Carregando', mensagem: 'Aguarde enquanto o servidor é contactado'});
  
  // We are using JSONP (as Apps Script had problems with CORS)
  var script = document.createElement('script');
  
  // Dear cryptographers, I know it's insecure against active attacks
  // But those are a lot hard, as we're using HTTPS
  // And it's a lot better than other authentication methods
  var sign = nacl.util.encodeBase64(nacl.sign.detached(
    nacl.util.decodeUTF8(JSON.stringify({
      aluno: el.id,
      hora: el.hora
    })),
    credentials.secretKey
  ));

  script.src = 'https://script.google.com/macros/s/AKfycbw-kz-BrkJN91Iw01TBh0FEppQlHAk4amAQzz3bwGkuIE6UlM8/exec' +
    '?callback=' + encodeURIComponent(callbackName) +
    '&aluno=' + encodeURIComponent(el.id) +
    '&user=' + encodeURIComponent(user) +
    '&pass=' + encodeURIComponent(sign) +
    '&hora=' + encodeURIComponent(el.hora);

  container.classList.add('semana-card-wide_hidden');

  var timer = setTimeout(function () {
    data.push(el);
    timer = false;
    handleResult({
      titulo: 'Erro',
      mensagem: 'Erro na conexão'
    });
  }, 30e3);

  window[callbackName] = function (result) {
    if (timer !== false) {
      clearTimeout(timer);
      handleResult(result);
    }
  };

  document.head.appendChild(script);
  script.addEventListener('load', function () {
    document.head.removeChild(script);
  });
  
  function handleResult (result) {
    container.classList.remove('semana-card-wide_hidden');
    showResult(result);

    if (data.length) {
      setTimeout(loop, 2500);
    } else {
      timer = null;
    }
  }
}
  
function showResult(result) {
  document.getElementById('semanaTitle').textContent = result.titulo;
  document.getElementById('semanaMessage').textContent = result.mensagem;
}
