import { BadRequestError, httpCall, InternalServerError, useContextProperty } from "@httpc/server";
import { Authenticated } from "../middlewares";


export type Message = {
    from: string
    to: string | string[]
    subject: string
    bodyText?: string
    bodyHtml?: string
}

export const sendEmail = httpCall(
    Authenticated(),
    async (message: Message) => {
        // we can use a lib to validate input
        // but ...
        if (!message || typeof message !== "object" ||
            !message.from ||
            !message.to || !message.to.length ||
            !message.subject ||
            (!message.bodyText && !message.bodyHtml)
        ) {
            throw new BadRequestError("Missing required properties");
        }

        const from = parseEmail(message.from);
        const token = useContextProperty("POSTMARK-SERVER-TOKEN");

        const response = await fetch("https://api.postmarkapp.com/email", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "X-Postmark-Server-Token": token,
                "Accept": "application/json",
            },
            body: JSON.stringify({
                From:from.name ? `${from.name} <${from.email}>` : from.email,
                To:parseMultiEmail(message.to).map(x=>x.email).join(","),
                Subject: message.subject.trim(),
                TextBody: message.bodyText,
                HtmlBody: message.bodyHtml,
                MessageStream:'outbound',
            })
        }).catch(() => undefined);

        if (!response || response.status >= 400) {
            throw new InternalServerError({
                message: (await response?.text().catch(() => "")) || "Unknown",
            });
        }
    }
);


const EMAIL_REGEX = /^(?:\s?(.*?)\s*<)?(.*?)>?$/;

function parseMultiEmail(email: string | string[]) {
    return (Array.isArray(email) ? email : [email])
        .flatMap(x => x.split(/,|;/).map(x => x.trim()))
        .map(parseEmail);
}

function parseEmail(text: string) {
    const [, name, email] = text.match(EMAIL_REGEX) || [];
    if (!email) {
        throw new BadRequestError();
    }

    return { name, email };
}
