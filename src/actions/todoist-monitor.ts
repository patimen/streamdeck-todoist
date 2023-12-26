import streamDeck, {
    Action,
    action,
    DidReceiveSettingsEvent,
    KeyDownEvent,
    SingletonAction,
    WillAppearEvent,
    WillDisappearEvent
} from "@elgato/streamdeck";
import fetch from 'node-fetch';

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({UUID: "com.johnlong.todoiststatus.counts"})
export class TodoistMonitor extends SingletonAction<QuerySettings> {
    logger = streamDeck.logger.createScope("Monitor");

    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it become visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
     * we're setting the title to the "count" that is incremented in {@link TodoistMonitor.onKeyDown}.
     */

    private intervals: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

    onWillAppear(ev: WillAppearEvent<QuerySettings>): void | Promise<void> {
        // Call updateButton every 60 seconds:
        this.startTimerIfNeeded(ev);
        if (ev.payload.settings.item_filter) {
            // trigger a getSettings, which will update the button
            return ev.action.getSettings();
        }
    }

    private startTimerIfNeeded(ev: WillAppearEvent<QuerySettings>) {
        if (!this.intervals.has(ev.action.id)) {
            this.intervals.set(ev.action.id, setInterval(() => {
                this.logger.debug("Timer fired")
                ev.action.getSettings()
            }, 60000));
        }
    }

    onWillDisappear(ev: WillDisappearEvent<QuerySettings>): Promise<void> | void {
        if (this.intervals.has(ev.action.id)) {
            clearInterval(this.intervals.get(ev.action.id) as NodeJS.Timeout);
            this.intervals.delete(ev.action.id);
        }
    }

    /**
     * This gets fired every time getSettings is called... this is tricky, because that call ALSO
     * returns a Promise<Settings>, but we don't really want to use that AND consume the event here.
     * For now, we use only the event. This also gets triggered when the PI updates
     * @param ev
     */
    onDidReceiveSettings(ev: DidReceiveSettingsEvent<QuerySettings>): Promise<void> | void {
        return this.updateButton(ev.payload.settings, ev.action)
    }

    /**
     * For now, simply refresh the button when the key is pressed.
     * */
    async onKeyDown(ev: KeyDownEvent<QuerySettings>): Promise<void> {
        // trigger a getSettings, which will update the button
        return ev.action.getSettings();
    }

    async updateButton(settings: QuerySettings, action: Action<QuerySettings>): Promise<void> {
        const globalSettings = await streamDeck.settings.getGlobalSettings() as TodoistSettings;
        const tasks = await this.getTasks(globalSettings.apiToken, settings.item_filter)
        let svg = this.getButtonSvg(tasks.length, settings);
        return action.setImage("data:image/svg+xml;charset=utf8," + svg);
    }


    getButtonSvg(taskCount: number, settings: QuerySettings): string {
        const getFontSize = (text: string, maxWidth: number, maxFontSize: number) =>
            Math.min(maxWidth / (text.length * 0.45), maxFontSize);
        const mainText = `${taskCount} Tasks`
        const backgroundColor = this.getColor(taskCount, settings)
        return `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
    <rect width="144" height="144" fill="${backgroundColor}" />
    <text x="72" y="72" dominant-baseline="middle" text-anchor="middle" fill="#000" font-size="${getFontSize(mainText, 140, 40)}px" font-family="Tahoma">${mainText}</text>
    <text x="72" y="135" dominant-baseline="middle" text-anchor="middle" fill="#000" font-size="${getFontSize(settings.item_name, 140, 28)}px" font-family="Tahoma">${settings.item_name}</text>
    </svg>`;
    }

    getColor(taskCount: number, settings: QuerySettings): string {
        if (settings.g_cutoff_1) {
            if (taskCount >= settings.g_cutoff_1)
                return settings.g_color_1 || "green";
            if (settings.g_cutoff_2 && taskCount >= settings.g_cutoff_2)
                return settings.g_color_2 || "yellow";
            if (settings.g_cutoff_3 && taskCount >= settings.g_cutoff_3)
                return settings.g_color_3 || "orange";
            else return settings.g_color_4 || "red";
        }
        if (settings.b_cutoff_1) {
            if (taskCount >= settings.b_cutoff_1)
                return settings.b_color_1 || "red";
            if (settings.b_cutoff_2 && taskCount >= settings.b_cutoff_2)
                return settings.b_color_2 || "orange";
            if (settings.b_cutoff_3 && taskCount >= settings.b_cutoff_3)
                return settings.b_color_3 || "yellow";
            else return settings.b_color_4 || "green";
        }
        return "white";
    }

    private async getTasks(apiToken: string, item_filter: string) {
        let url = `https://api.todoist.com/rest/v2/tasks?filter=${encodeURIComponent(item_filter)}`;
        this.logger.debug(`Fetching tasks from ${url}`)
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });
        if (!response.ok) {
            this.logger.error(`Error fetching tasks: ${response.statusText}`)
            throw new Error(`Error fetching tasks: ${response.statusText}`);
        }
        this.logger.debug(`Got response: ${JSON.stringify(response)}`)
        return await response.json() as Task[];
    }
}

// These are the global settings for the plugin
class TodoistSettings {
    apiToken: string;

    constructor(apiToken: string) {
        this.apiToken = apiToken;
    }
}


/**
 * these are the settings for each button (instance)
 */
type QuerySettings = {
    item_name: string;
    item_filter: string;
    g_cutoff_1: number | null;
    g_cutoff_2: number | null;
    g_cutoff_3: number | null;
    g_color_1: string | null;
    g_color_2: string | null;
    g_color_3: string | null;
    g_color_4: string | null;
    b_cutoff_1: number | null;
    b_cutoff_2: number | null;
    b_cutoff_3: number | null;
    b_color_1: string | null;
    b_color_2: string | null;
    b_color_3: string | null;
    b_color_4: string | null;
};

type Task = {
    id: string;
    content: string;
}
