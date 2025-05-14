const appendSection = (
  sectionContainer,
  sectionImage,
  sectionTitle,
  sectionMessage,
  sectionId,
  toPage
) => {
  const sectionHTML = `
    <div class="section" id="${sectionId}" onclick="(()=>{location.href = '${toPage}'})()">
        <img src="${sectionImage}" alt="${sectionTitle}" class="section-image">
        <div class="section-content">
            <h2 class="section-title">${sectionTitle}</h2>
            <p class="section-message">${sectionMessage}</p>
        </div>`;
  sectionContainer.innerHTML += sectionHTML;
};
