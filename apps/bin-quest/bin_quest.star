load("http.star", "http")
load("render.star", "render")

FONT = "CG-pixel-3x5-mono"
FONT_NAME = "tb-8"
COLOR_A = "#56e0d2"
COLOR_B = "#b38cff"

SAMPLE = {
    "members": [
        {"id": "a", "name": "JON", "total": 10, "dealt": 10, "remaining": 0},
        {"id": "b", "name": "KP", "total": 10, "dealt": 9.25, "remaining": 0.75},
    ],
}

def _load_bins(config):
    api_url = config.str("api_url")
    if not api_url:
        return SAMPLE

    token = config.str("read_token")
    headers = {}
    if token:
        headers["Authorization"] = "Bearer %s" % token
    response = http.get(
        "%s/api/bins" % api_url,
        headers = headers,
        ttl_seconds = 120,
    )
    if response.status_code != 200:
        print("Bin Quest request failed with HTTP %d" % response.status_code)
        return None
    data = response.json()
    members = data.get("members", [])
    # Until the first real bins are entered, make the physical display useful
    # as a design preview with the requested household scores.
    if len(members) >= 2 and members[0].get("total", 0) == 0 and members[1].get("total", 0) == 0:
        return {
            "members": [
                {"id": "a", "name": members[0].get("name", "JON"), "total": 10, "dealt": 10, "remaining": 0},
                {"id": "b", "name": members[1].get("name", "KP"), "total": 10, "dealt": 9.25, "remaining": 0.75},
            ],
        }
    return data

def _progress_bar(total, dealt, color):
    bar_width = 60
    filled_width = 0
    if total > 0:
        filled_width = int(bar_width * dealt / total)
    return render.Box(
        width = bar_width,
        height = 6,
        color = "#252a33",
        child = render.Row(
            children = [
                render.Box(width = filled_width, height = 6, color = color),
                render.Box(width = bar_width - filled_width, height = 6, color = "#252a33"),
            ],
        ),
    )

def _count(value):
    return str(int(value))

def _member_lane(member, color):
    total = member.get("total", 0)
    dealt = member.get("dealt", 0)
    display_name = member.get("name", "?")[:8]
    return render.Box(
        height = 16,
        child = render.Column(
            children = [
                render.Box(
                    height = 9,
                    child = render.Row(
                        main_align = "center",
                        cross_align = "center",
                        children = [
                            render.Box(
                                width = 60,
                                child = render.Row(
                                    expanded = True,
                                    main_align = "space_between",
                                    cross_align = "center",
                                    children = [
                                        render.Text(display_name, font = FONT_NAME, color = color),
                                        render.Text(
                                            "%s/%s" % (_count(dealt), _count(total)),
                                            font = FONT,
                                            color = "#f7f8fa",
                                        ),
                                    ],
                                ),
                            ),
                        ],
                    ),
                ),
                render.Row(
                    main_align = "center",
                    cross_align = "center",
                    children = [_progress_bar(total, dealt, color)],
                ),
            ],
        ),
    )

def _offline():
    return render.Root(
        max_age = 300,
        child = render.Box(
            color = "#080b11",
            child = render.Column(
                main_align = "center",
                cross_align = "center",
                children = [
                    render.Text("BIN QUEST", font = FONT, color = COLOR_A),
                    render.Text("OFFLINE", font = "5x8", color = "#ff6f83"),
                ],
            ),
        ),
    )

def main(config):
    data = _load_bins(config)
    if data == None:
        return _offline()

    members = data.get("members", [])
    if len(members) < 2:
        return _offline()
    return render.Root(
        max_age = 300,
        child = render.Box(
            color = "#080b11",
            child = render.Column(
                children = [
                    _member_lane(members[0], COLOR_A),
                    _member_lane(members[1], COLOR_B),
                ],
            ),
        ),
    )
