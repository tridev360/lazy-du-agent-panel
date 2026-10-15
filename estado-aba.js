'use strict';
// A pagina dedicada preserva o componente de cronograma, sem a navegacao antiga.
document.addEventListener('DOMContentLoaded', () => {
  const host = document.getElementById('cronograma-casa');
  if (host) host.hidden = false;
});
