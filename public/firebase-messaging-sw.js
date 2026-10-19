// Service worker do FCM na web: recebe o lembrete com o Navalha fechado (no iPhone, só como app da Tela de Início).
// A mensagem do Worker vem com `notification`, que o SDK mostra sozinho; aqui só ligamos o Firebase e o clique.
// A versão dos scripts acompanha o pacote `firebase` do projeto (13.0.0). Valores públicos do App Web.
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAoYWOJvEHKmFytUUREM2fJrMJv-CI9lVg',
  authDomain: 'navalha-1a8f5.firebaseapp.com',
  projectId: 'navalha-1a8f5',
  appId: '1:1082941771818:web:b03f15c6ce2344bafc7353',
  messagingSenderId: '1082941771818',
});
firebase.messaging();

// Tocar no lembrete abre (ou traz para frente) a tela de agendamentos.
self.addEventListener('notificationclick', evento => {
  evento.notification.close();
  evento.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
    const aberta = janelas.find(j => j.url.startsWith(self.location.origin));
    return aberta ? aberta.focus().then(j => j.navigate('/agendamentos')) : clients.openWindow('/agendamentos');
  }));
});
