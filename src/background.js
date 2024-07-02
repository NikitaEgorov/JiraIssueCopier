async function getCurrentTab() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

const copyToClipboardMsg = async () => {
  const currentTab = await getCurrentTab();
  if (currentTab)
    chrome.tabs.sendMessage(currentTab.id, {
      message: "jira_copy_to_clipboard",
    });
};

chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-to-clipboard") {
    copyToClipboardMsg();
  }
});
