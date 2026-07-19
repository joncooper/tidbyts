load("http.star", "http")
load("render.star", "render")

FONT_SMALL = "CG-pixel-3x5-mono"
FONT_LARGE = "6x13"

SAMPLE = {
    "trailing_24h": 4,
    "trailing_7d": 17,
    "trailing_30d": 43,
    "stale": False,
}

def _load_counts(config):
    api_url = config.str("api_url")
    if not api_url:
        return SAMPLE

    token = config.str("read_token")
    headers = {}
    if token:
        headers["Authorization"] = "Bearer %s" % token
    response = http.get(
        "%s/api/prs" % api_url,
        headers = headers,
        ttl_seconds = 300,
    )
    if response.status_code != 200:
        print("PR metrics request failed with HTTP %d" % response.status_code)
        return None
    return response.json()

def _metric_card(value, label, color):
    # JSON numbers arrive in Pixlet as floats, even when the API returns a
    # whole count. Keep the display compact and avoid rendering values like
    # "46.0" on the 20-pixel-wide cards.
    display_value = str(int(value))
    return render.Box(
        width = 20,
        height = 23,
        color = color,
        child = render.Column(
            main_align = "center",
            cross_align = "center",
            children = [
                render.Text(
                    content = display_value,
                    font = FONT_LARGE,
                    color = "#ffffff",
                ),
                render.Text(
                    content = label,
                    font = FONT_SMALL,
                    color = "#d7e2f0",
                ),
            ],
        ),
    )

def _offline():
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = "#080b11",
            child = render.Column(
                main_align = "center",
                cross_align = "center",
                children = [
                    render.Text("LANDED PRS", font = FONT_SMALL, color = "#67e8d5"),
                    render.Text("OFFLINE", font = "5x8", color = "#ff6f83"),
                ],
            ),
        ),
    )

def main(config):
    counts = _load_counts(config)
    if counts == None:
        return _offline()

    stale_color = "#ffb454" if counts.get("stale", False) else "#67e8d5"
    return render.Root(
        max_age = 900,
        child = render.Box(
            color = "#080b11",
            child = render.Column(
                children = [
                    render.Box(
                        height = 9,
                        child = render.Row(
                            main_align = "center",
                            cross_align = "center",
                            children = [
                                render.Box(width = 3, height = 3, color = stale_color),
                                render.Text(
                                    content = " LANDED PRS",
                                    font = FONT_SMALL,
                                    color = "#f7f8fa",
                                ),
                            ],
                        ),
                    ),
                    render.Row(
                        expanded = True,
                        main_align = "space_between",
                        children = [
                            _metric_card(counts.get("trailing_24h", 0), "24H", "#123a3a"),
                            _metric_card(counts.get("trailing_7d", 0), "7D", "#24304f"),
                            _metric_card(counts.get("trailing_30d", 0), "30D", "#432b52"),
                        ],
                    ),
                ],
            ),
        ),
    )
