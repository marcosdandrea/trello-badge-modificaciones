/* global TrelloPowerUp */

// API Key generada en https://trello.com/power-ups/admin
// Es pública/segura de exponer client-side: no reemplaza autenticación,
// solo identifica a la app. Nunca poner acá el "Secret".
var API_KEY = 'c638996caa5e11f7932f1f2963509de9';

// Filtramos solo las acciones que representan "modificaciones" reales
// del contenido de la tarjeta (podés sumar más tipos si querés, ej:
// addAttachmentToCard, updateCheckItemStateOnCard)
var ACTION_FILTER = 'updateCard,commentCard';

function buildActionsUrl(cardId, token, sinceIso) {
  return 'https://api.trello.com/1/cards/' + cardId + '/actions'
    + '?filter=' + ACTION_FILTER
    + '&since=' + encodeURIComponent(sinceIso)
    + '&fields=date&limit=50'
    + '&key=' + API_KEY
    + '&token=' + token;
}

function getStoredToken(t) {
  // Guardamos el token nosotros mismos (no con getRestApi(), que tiene
  // un bug de postMessage en Power-Ups auto-hosteados fuera de trello.com)
  return t.get('member', 'private', 'token', null);
}

// El ID de tarjeta de Trello es un ObjectId de Mongo: los primeros 8
// caracteres hex codifican el timestamp unix de creación. Lo usamos como
// fallback cuando todavía no sabemos cuándo la persona la vio por última vez.
function cardCreationDate(cardId) {
  var seconds = parseInt(cardId.substring(0, 8), 16);
  return new Date(seconds * 1000);
}

window.TrelloPowerUp.initialize({

  // Badge que se ve en el FRENTE de la tarjeta, en la vista de tablero
  'card-badges': function (t, opts) {
    return getStoredToken(t).then(function (token) {
      if (!token) {
        // Todavía no autorizó: mostramos un candado sutil en vez de nada,
        // así se nota que falta un paso, sin ser invasivo.
        return [{ text: '🔒', color: 'light-gray' }];
      }

      return Promise.all([
        t.get('card', 'private', 'lastViewed', null),
        t.card('id')
      ]).then(function (results) {
        var lastViewed = results[0];
        var card = results[1];

        // Si nunca abriste esta tarjeta con el Power-Up activo, no hay
        // baseline guardada -> usamos la fecha de creación de la tarjeta
        // como punto de partida, así igual se muestra el contador (con
        // el total acumulado desde que existe la tarjeta) en vez de nada.
        var sinceIso = lastViewed
          ? new Date(lastViewed).toISOString()
          : cardCreationDate(card.id).toISOString();

        var url = buildActionsUrl(card.id, token, sinceIso);

        return fetch(url)
          .then(function (res) {
            if (!res.ok) throw new Error('Trello API ' + res.status);
            return res.json();
          })
          .then(function (actions) {
            var count = Array.isArray(actions) ? actions.length : 0;
            if (count === 0) return [];
            return [{
              text: String(count),
              icon: 'https://marcosdandrea.github.io/trello-badge-modificaciones/alert-icon.svg',
              monochrome: false, // sin esto, Trello re-tiñe el ícono a gris/blanco según el tema
              color: 'red',
              refresh: 15 // segundos; 10 es el mínimo permitido por Trello
            }];
          })
          .catch(function () {
            return []; // fallo silencioso: mejor no mostrar nada que romper la UI
          });
      });
    });
  },

  // Badge en el REVERSO de la tarjeta (arriba). Se ejecuta cada vez que
  // alguien abre la tarjeta -> lo usamos para resetear el contador.
  'card-detail-badges': function (t, opts) {
    return getStoredToken(t).then(function (token) {
      if (!token) {
        return [{
          title: 'Modificaciones',
          text: 'Autorizar acceso',
          callback: function (t) {
            return t.popup({
              title: 'Autorizar acceso',
              url: './authorize.html',
              height: 140
            });
          }
        }];
      }

      // Guardamos "ahora" como el último momento en que ESTE usuario
      // vio la tarjeta. t.set con visibilidad 'private' guarda el dato
      // por miembro automáticamente (cada persona tiene su propio valor).
      return t.set('card', 'private', 'lastViewed', Date.now()).then(function () {
        return [{
          title: 'Modificaciones',
          text: 'Visto ahora ✓',
          color: 'green'
        }];
      });
    });
  }

}, {
  appKey: API_KEY,
  appName: 'Badge de notificacion de cambios por tarjeta'
});
