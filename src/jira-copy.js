(() => {
  "use strict";

  class Utils {
    static throttle(delay, fn) {
      let timeout = null;

      return function perform(...args) {
        if (timeout) return;
        timeout = setTimeout(() => {
          fn(...args);
          clearTimeout(timeout);
          timeout = null;
        }, delay);
      };
    }
  }

  class DOMUtils {
    static insertAfter(newNode, referenceNode) {
      referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    }

    static fromHtml(html) {
      const container = document.createElement("div");
      container.innerHTML = html.trim();
      return container.firstChild;
    }

    static injectScript(file, elementName) {
      const node = document.getElementsByTagName(elementName)[0];
      const script = document.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.setAttribute("src", file);
      node.appendChild(script);
    }
  }

  class Clipboard {
    static async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        return false;
      }
    }
  }

  class Jira {
    static Page = class {
      static get exists() {
        return (
          document
            .querySelector("meta[name=application-name]")
            ?.getAttribute("data-name") === "jira"
        );
      }
    };

    static Layout = class {
      static get current() {
        const availableLayouts = [
          this.DetailView,
          this.OldView,
          this.CloudView,
        ];
        return availableLayouts.find((layout) => layout.exists) || null;
      }

      static CloudView = class {
        static name = "Cloud View Layout";

        static get exists() {
          return !!window.location.origin?.includes("atlassian.net");
        }

        static get issue() {
          const issueKey =
            document.querySelector(
              "div[data-testid='issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container'] li>a>span"
            )?.textContent || "";
          const issueSummary =
            document.querySelector(
              "h1[data-testid='issue.views.issue-base.foundation.summary.heading']"
            )?.textContent || "";
          const issueUrl =
            document.querySelector(
              "div[data-testid='issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container'] li>a"
            )?.href || "";
          return issueKey
            ? new Jira.Issue(issueKey, issueSummary, issueUrl)
            : null;
        }

        static get buttonContainer() {
          return document.querySelector(
            "div[data-testid='issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container']"
          );
        }

        static renderButton(button) {
          this.buttonContainer.appendChild(button);
        }
      };

      static OldView = class {
        static name = "Old View Layout";

        static get exists() {
          return !!document.getElementById("issue-content");
        }

        static get issue() {
          const issueKey =
            document
              .getElementById("key-val")
              ?.getAttribute("data-issue-key") || "";
          const issueSummary =
            document.getElementById("summary-val")?.textContent || "";
          const issueUrl = document.getElementById("key-val")?.href || "";

          return issueKey
            ? new Jira.Issue(issueKey, issueSummary, issueUrl)
            : null;
        }

        static get buttonContainer() {
          return document.getElementById("key-val");
        }

        static renderButton(button) {
          DOMUtils.insertAfter(button, this.buttonContainer);
        }
      };

      static DetailView = class {
        static name = "Detail View Layout";

        static get exists() {
          return !!document.getElementById("ghx-detail-issue");
        }

        static get issue() {
          const issueKey =
            document
              .getElementById("ghx-detail-issue")
              ?.getAttribute("data-issuekey") || "";
          const issueSummary =
            document.getElementById("summary-val")?.textContent || "";
          const issueUrl =
            document.querySelector("#issuekey-val a")?.href || "";

          return issueKey
            ? new Jira.Issue(issueKey, issueSummary, issueUrl)
            : null;
        }

        static get buttonContainer() {
          return document.getElementById("issuekey-val");
        }

        static renderButton(button) {
          DOMUtils.insertAfter(button, this.buttonContainer);
        }
      };
    };

    static Button = class {
      static create({ id, onClick }) {
        const buttonHtml = `<button id=${id} class="aui-button aui-button-compact" 
                             style="margin-left: 5px">
                             <span class="aui-icon aui-icon-small 
                                          aui-iconfont-copy-clipboard"></span>
                             Copy</button>`;
        const button = DOMUtils.fromHtml(buttonHtml);
        button.addEventListener("click", onClick);
        return button;
      }

      static exists(id) {
        return !!document.getElementById(id);
      }
    };

    static Issue = class {
      constructor(key, summary, url) {
        this.key = key;
        this.summary = summary;
        this.url = url;
      }

      format() {
        return `[${this.key}](${this.url}) ${this.summary}`
      }

      async copyToClipboard() {
        if (this.summary) {
          const issueText = this.format();
          if (await Clipboard.copy(issueText)) {
            window.postMessage({
              type: "jira_success_copied_to_clipboard",
              options: { title: "Copied to clipboard", body: issueText },
            });
          }
        }
      }
    };

    static Notifications = class {
      static setup(action) {
        DOMUtils.injectScript(
          chrome.runtime.getURL("jira-toast.js"),
          "body"
        );

        chrome.runtime.onMessage.addListener(
          (request, sender, sendResponse) => {
            if (request.message === "jira_copy_to_clipboard") {
              action();
            }
          }
        );
      }
    };
  }

  class Observer {
    static defaultOptions = {
      target: document,
      config: {
        attributes: false,
        childList: true,
        subtree: true,
      },
    };

    static start({ condition, action, options }) {
      const handler = Utils.throttle(1000, () => {
        if (condition()) {
          action();
        }
      });

      const _options = { ...this.defaultOptions, ...options };
      const observer = new MutationObserver(handler);
      observer.observe(_options.target, _options.config);
      return observer;
    }
  }

  class App {
    static async start() {
      if (!Jira.Page.exists) {
        return;
      }

      const copyIssueToClipboard = () =>
        Jira.Layout.current?.issue?.copyToClipboard();

      Jira.Notifications.setup(copyIssueToClipboard);

      const buttonId = "copy-issue-button";
      const observerSeup = {
        condition: () =>
          !Jira.Button.exists(buttonId) &&
          !!Jira.Layout.current?.buttonContainer &&
          !!Jira.Layout.current?.issue?.summary,

        action: () => {
          const button = Jira.Button.create({
            id: buttonId,
            onClick: copyIssueToClipboard,
          });

          Jira.Layout.current.renderButton(button);
        },
      };

      Observer.start(observerSeup);
    }
  }

  App.start();
})();
