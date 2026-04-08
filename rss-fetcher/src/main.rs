use quick_xml::de::from_str;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::process;
use std::time::Duration;

const USER_AGENT: &str = "Mozilla/5.0 (RSS Reader; +https://example.com)";

#[derive(Debug, Deserialize)]
struct RssDocument {
    channel: Channel,
}

#[derive(Debug, Deserialize)]
struct Channel {
    title: Option<String>,
    link: Option<String>,
    #[serde(rename = "lastBuildDate")]
    last_build_date: Option<String>,
    #[serde(default)]
    item: Vec<RssItem>,
}

#[derive(Debug, Deserialize)]
struct RssItem {
    title: Option<String>,
    link: Option<String>,
    #[serde(rename = "pubDate")]
    pub_date: Option<String>,
    description: Option<String>,
    guid: Option<GuidValue>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum GuidValue {
    Text(String),
    Node(GuidNode),
}

#[derive(Debug, Deserialize)]
struct GuidNode {
    #[serde(rename = "$text")]
    text: Option<String>,
}

#[derive(Debug, Serialize)]
struct FeedPayload {
    channel: ChannelPayload,
    items: Vec<ItemPayload>,
}

#[derive(Debug, Serialize)]
struct ChannelPayload {
    title: Option<String>,
    link: Option<String>,
    #[serde(rename = "lastBuildDate")]
    last_build_date: Option<String>,
}

#[derive(Debug, Serialize)]
struct ItemPayload {
    title: String,
    link: String,
    #[serde(rename = "pubDate")]
    pub_date: String,
    description: String,
    guid: String,
}

fn guid_to_string(guid: Option<GuidValue>) -> String {
    match guid {
        Some(GuidValue::Text(value)) => value,
        Some(GuidValue::Node(node)) => node.text.unwrap_or_default(),
        None => String::new(),
    }
}

fn fetch_and_parse_feed(url: &str) -> Result<FeedPayload, Box<dyn std::error::Error>> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(USER_AGENT)
        .build()?;

    let xml = client.get(url).send()?.error_for_status()?.text()?;
    let rss: RssDocument = from_str(&xml)?;

    let items = rss
        .channel
        .item
        .into_iter()
        .map(|item| ItemPayload {
            title: item.title.unwrap_or_default(),
            link: item.link.unwrap_or_default(),
            pub_date: item.pub_date.unwrap_or_default(),
            description: item.description.unwrap_or_default(),
            guid: guid_to_string(item.guid),
        })
        .collect();

    Ok(FeedPayload {
        channel: ChannelPayload {
            title: rss.channel.title,
            link: rss.channel.link,
            last_build_date: rss.channel.last_build_date,
        },
        items,
    })
}

fn main() {
    let rss_url = env::args()
        .nth(1)
        .unwrap_or_else(|| "https://www.thehindu.com/feeder/default.rss".to_string());

    match fetch_and_parse_feed(&rss_url) {
        Ok(payload) => match serde_json::to_string(&payload) {
            Ok(json) => {
                println!("{json}");
            }
            Err(error) => {
                eprintln!("Failed to serialize feed payload: {error}");
                process::exit(1);
            }
        },
        Err(error) => {
            eprintln!("Failed to fetch RSS feed: {error}");
            process::exit(1);
        }
    }
}
