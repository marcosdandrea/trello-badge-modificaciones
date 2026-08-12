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

window.TrelloPowerUp.initialize({

  // Badge que se ve en el FRENTE de la tarjeta, en la vista de tablero
  'card-badges': function (t, opts) {
    return t.getRestApi().isAuthorized().then(function (isAuthorized) {
      if (!isAuthorized) {
        // Todavía no autorizó: mostramos un candado sutil en vez de nada,
        // así se nota que falta un paso, sin ser invasivo.
        return [{ text: '🔒', color: 'light-gray' }];
      }

      return Promise.all([
        t.getRestApi().getToken(),
        t.get('card', 'private', 'lastViewed', null),
        t.card('id')
      ]).then(function (results) {
        var token = results[0];
        var lastViewed = results[1];
        var card = results[2];

        // Primera vez que este Power-Up corre en esta tarjeta para este
        // usuario: no hay baseline todavía. No mostramos badge para no
        // generar ruido con el historial completo de la tarjeta.
        // Se establece la primera vez que la persona abre la tarjeta.
        if (!lastViewed) {
          return [];
        }

        var sinceIso = new Date(lastViewed).toISOString();
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
    return t.getRestApi().isAuthorized().then(function (isAuthorized) {
      if (!isAuthorized) {
        return [{
          title: 'Modificaciones',
          text: 'Autorizar acceso',
          callback: function (t) {
            return t.getRestApi().authorize({ scope: 'read' });
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

});
