console.log("YouTube Transcript Fetcher content script loaded.");

const selectors = {
  transcriptButton: 'ytd-engagement-panel-title-action-button button, button[aria-label="Show transcript"], tp-yt-paper-button[aria-label="Show transcript"]',
  transcriptPanel: 'ytd-transcript-renderer, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
  transcriptSegment: 'ytd-transcript-segment-renderer',
  transcriptText: '.ytd-transcript-segment-renderer > div > div > yt-formatted-string',
  transcriptDisplayId: 'youtube-transcript-display-container'
};

function getElement(selector, context = document) {
  return context.querySelector(selector);
}

function getAllElements(selector, context = document) {
  return context.querySelectorAll(selector);
}

async function openTranscriptPanel() {
  const transcriptButton = getElement(selectors.transcriptButton);
  let transcriptPanel = getElement(selectors.transcriptPanel);

  if (transcriptPanel) {
    console.log("Transcript panel is already visible or present.");
    return transcriptPanel;
  }

  if (transcriptButton) {
    console.log("Transcript button found. Clicking to open transcript...");
    transcriptButton.click();
    return new Promise((resolve) => {
      let retries = 0;
      const maxRetries = 10; // 5 seconds
      const interval = setInterval(() => {
        transcriptPanel = getElement(selectors.transcriptPanel);
        if (transcriptPanel) {
          clearInterval(interval);
          console.log("Transcript panel appeared after click.");
          resolve(transcriptPanel);
        } else if (retries >= maxRetries) {
          clearInterval(interval);
          console.log("Timeout waiting for transcript panel to appear after click.");
          resolve(null);
        }
        retries++;
      }, 500);
    });
  } else {
    console.log("Transcript button not found, cannot open panel.");
    return null;
  }
}

async function extractTranscriptText(panel) {
  if (!panel) {
    console.log("No transcript panel provided to extract text from.");
    return null; // Should be handled by caller if panel is null
  }
  console.log("Attempting to extract transcript text from panel:", panel);
  
  // Wait for transcript segments to load
  // More robust: use MutationObserver on the panel for segment changes.
  await new Promise(resolve => setTimeout(resolve, 2000)); 

  let segments = getAllElements(selectors.transcriptSegment, panel);
  if (!segments || segments.length === 0) {
    const innerPanel = getElement('div#segments-container.ytd-transcript-body-renderer', panel);
    if (innerPanel) {
        console.log("Found segments-container, trying to get segments from there.");
        segments = getAllElements(selectors.transcriptSegment, innerPanel);
    }
  }

  if (!segments || segments.length === 0) {
    console.log("No transcript segments found within the panel (or segments-container). The structure might have changed or transcript is empty.");
    return ""; // Return empty string for empty transcript
  }

  return Array.from(segments)
    .map(segment => {
      const textEl = getElement(selectors.transcriptText, segment);
      return textEl ? textEl.textContent.trim() : '';
    })
    .join('\n');
}


function displayTranscriptInPage(message, type = 'info') {
  const existingDisplay = document.getElementById(selectors.transcriptDisplayId);
  if (existingDisplay) {
    existingDisplay.remove();
  }

  const displayDiv = document.createElement('div');
  displayDiv.id = selectors.transcriptDisplayId;
  displayDiv.style.position = 'fixed';
  displayDiv.style.bottom = '10px';
  displayDiv.style.right = '10px';
  displayDiv.style.width = '300px';
  displayDiv.style.maxHeight = '400px';
  displayDiv.style.overflowY = 'auto';
  displayDiv.style.padding = '10px';
  displayDiv.style.zIndex = '9999';
  displayDiv.style.fontSize = '14px';
  displayDiv.style.fontFamily = 'Arial, sans-serif';
  displayDiv.style.color = '#333';
  displayDiv.style.whiteSpace = 'pre-wrap'; // Respect newlines

  // Style based on type
  if (type === 'error') {
    displayDiv.style.borderColor = 'red';
    displayDiv.style.backgroundColor = '#ffe0e0';
  } else if (type === 'success') {
    displayDiv.style.borderColor = 'green';
    displayDiv.style.backgroundColor = '#e0ffe0';
  } else { // 'info' or default
    displayDiv.style.borderColor = '#ccc';
    displayDiv.style.backgroundColor = 'white';
  }

  const header = document.createElement('h4');
  header.textContent = 'Video Transcript';
  header.style.marginTop = '0';
  header.style.marginBottom = '5px';
  displayDiv.appendChild(header);
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.style.padding = '2px 5px';
  closeButton.style.fontSize = '12px';
  closeButton.onclick = () => displayDiv.remove();
  displayDiv.appendChild(closeButton);

  const contentP = document.createElement('p');
  contentP.textContent = message; // Display the actual message passed
  displayDiv.appendChild(contentP);

  document.body.appendChild(displayDiv);
  console.log(`Transcript display updated. Type: ${type}, Message: "${message}"`);
}

async function processTranscriptRequest() {
  console.log("Processing transcript request...");
  try {
    let transcriptPanel = await openTranscriptPanel();
    
    if (!transcriptPanel) {
        // If openTranscriptPanel returned null (button not found or timed out),
        // check if the panel might already exist (e.g., was already open).
        transcriptPanel = getElement(selectors.transcriptPanel);
        if (transcriptPanel) {
            console.log("Transcript panel was already open or appeared without explicit click action success.");
        }
    }

    if (!transcriptPanel) {
      displayTranscriptInPage("Transcript not available for this video (panel could not be found or opened).", 'info');
      console.log("processTranscriptRequest: No transcript panel found.");
      return { status: "No transcript panel", message: "Transcript panel not found." };
    }

    // Panel exists, try to extract text
    const transcript = await extractTranscriptText(transcriptPanel);

    if (transcript === null) { 
        // This case should ideally not be hit if transcriptPanel is valid,
        // as extractTranscriptText is expected to return "" for empty or error.
        // But as a safeguard:
        displayTranscriptInPage("Error: Could not extract transcript data (null returned).", 'error');
        console.error("processTranscriptRequest: extractTranscriptText returned null.");
        return { status: "Error", message: "Failed to extract transcript (null)." };
    } else if (transcript.trim() === "") {
      displayTranscriptInPage("Transcript is available but empty.", 'info');
      console.log("processTranscriptRequest: Transcript is empty.");
      return { status: "Success", message: "Transcript is empty." };
    } else {
      displayTranscriptInPage(transcript, 'success');
      console.log("processTranscriptRequest: Transcript fetched and displayed.");
      return { status: "Success", message: "Transcript fetched and displayed." };
    }
  } catch (error) {
    console.error("Error processing transcript request:", error);
    displayTranscriptInPage(`Error fetching transcript: ${error.message}`, 'error');
    return { status: "Error", message: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in content script:", request);
  if (request.action === "displayTranscript") {
    processTranscriptRequest().then(response => {
      sendResponse(response);
    }).catch(error => {
      console.error("Critical error in processTranscriptRequest promise chain:", error);
      displayTranscriptInPage(`A critical error occurred: ${error.message}`, 'error');
      sendResponse({status: "Critical Error", message: error.toString()});
    });
    return true; // Indicates that the response is sent asynchronously
  }
});

if (window.location.href.startsWith("https://www.youtube.com/watch")) {
  console.log("Initial load on a YouTube video page. Content script active.");
  // To avoid automatic display on load, ensure this is commented out:
  // console.log("Waiting 7 seconds before trying to fetch transcript automatically...");
  // setTimeout(processTranscriptRequest, 7000); 
} else {
  console.log("Current page is not a YouTube video page.");
}
