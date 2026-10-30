// Dragging is an optional shortcut. The stage selector in the table remains the keyboard path.
(() => {
  function setup() {
    const board = document.getElementById('pipeline-board');
    const form = document.getElementById('DragStageForm') || document.querySelector('form[name="DragStageForm"]');
    if (!board || !form || board.dataset.dragReady) return;
    board.dataset.dragReady = 'true';

    for (const card of board.querySelectorAll('.zcrm-deal-card[id^="crm-deal-"]')) card.draggable = true;

    board.addEventListener('dragstart', event => {
      const card = event.target.closest('.zcrm-deal-card[id^="crm-deal-"]');
      if (!card || !event.dataTransfer) return;
      event.dataTransfer.setData('text/plain', card.id);
      event.dataTransfer.effectAllowed = 'move';
    });
    board.addEventListener('dragover', event => {
      if (!event.target.closest('.zcrm-board-column[id^="crm-stage-"]')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    board.addEventListener('drop', event => {
      const column = event.target.closest('.zcrm-board-column[id^="crm-stage-"]');
      const card = document.getElementById(event.dataTransfer?.getData('text/plain'));
      if (!column || !card || !board.contains(card)) return;
      event.preventDefault();
      // Moqui adds numeric suffixes to IDs rendered inside section-iterate.
      form.elements.salesOpportunityId.value = card.id.slice('crm-deal-'.length).replace(/(?:_\d+)+$/, '');
      form.elements.opportunityStageId.value = column.id.slice('crm-stage-'.length).replace(/(?:_\d+)+$/, '');
      form.requestSubmit();
    });
  }

  document.addEventListener('DOMContentLoaded', setup);
  document.addEventListener('moqui-screen-loaded', setup);
  if (document.readyState !== 'loading') setup();
})();
