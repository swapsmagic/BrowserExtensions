document.getElementById('fetchAndDisplayTranscript').addEventListener('click', () => {
  const statusDiv = document.getElementById('statusMessage');
  statusDiv.textContent = 'Processing...'; // Initial feedback
  statusDiv.className = 'status-info'; // Default styling

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "displayTranscript"}, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError.message);
          statusDiv.textContent = `Error: ${chrome.runtime.lastError.message}`;
          statusDiv.className = 'status-error';
          return;
        }
        
        if (response) {
          console.log("Response from content script:", response);
          statusDiv.textContent = response.message || 'No message received.';
          if (response.status === "Success") {
            statusDiv.className = 'status-success';
          } else if (response.status === "Error" || response.status === "Critical Error") {
            statusDiv.className = 'status-error';
          } else { // Info or other statuses
            statusDiv.className = 'status-info';
          }
        } else {
          statusDiv.textContent = 'No response from content script.';
          statusDiv.className = 'status-error';
        }
      });
    } else {
      console.error("Could not get active tab ID.");
      statusDiv.textContent = 'Error: Could not connect to the page.';
      statusDiv.className = 'status-error';
    }
  });
});
