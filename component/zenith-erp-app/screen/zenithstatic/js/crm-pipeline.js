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
      event.dataTransfer.setData('text/plain', card.id.slice('crm-deal-'.length));
      event.dataTransfer.effectAllowed = 'move';
    });
    board.addEventListener('dragover', event => {
      if (!event.target.closest('.zcrm-board-column[id^="crm-stage-"]')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    board.addEventListener('drop', event => {
      const column = event.target.closest('.zcrm-board-column[id^="crm-stage-"]');
      const dealId = event.dataTransfer?.getData('text/plain');
      if (!column || !dealId || !board.querySelector(`#crm-deal-${CSS.escape(dealId)}`)) return;
      event.preventDefault();
      form.elements.salesOpportunityId.value = dealId;
      form.elements.opportunityStageId.value = column.id.slice('crm-stage-'.length);
      form.requestSubmit();
    });
  }

  document.addEventListener('DOMContentLoaded', setup);
  document.addEventListener('moqui-screen-loaded', setup);
  if (document.readyState !== 'loading') setup();
})();
