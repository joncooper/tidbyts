load("http.star", "http")
load("render.star", "render")

FONT_SMALL = "CG-pixel-3x5-mono"
FONT_LABEL = "tb-8"
FONT_DIGIT = "6x13"
CODEX = "#56e0d2"
CLAUDE = "#c08cff"

SAMPLE = {
    "trailing_24h": {"codex": 2840000, "claude": 790000},
    "trailing_7d": {"codex": 15300000, "claude": 4200000},
    "trailing_30d": {"codex": 10741000000, "claude": 1929000000},
}

def _million_digits(value):
    # The odometer is deliberately fixed at five aligned digits. Values are
    # rounded to millions and use a leading zero so both rows line up.
    millions = int(value / 1000000 + 0.5)
    if value > 0 and millions == 0:
        millions = 1
    if millions > 99999:
        millions = 99999
    display = str(millions)
    if len(display) == 1:
        display = "0000%s" % display
    elif len(display) == 2:
        display = "000%s" % display
    elif len(display) == 3:
        display = "00%s" % display
    elif len(display) == 4:
        display = "0%s" % display
    return display

def _load_usage(config):
    api_url = config.str("api_url")
    if not api_url:
        return SAMPLE

    token = config.str("read_token")
    headers = {}
    if token:
        headers["Authorization"] = "Bearer %s" % token
    response = http.get(
        "%s/api/usage" % api_url,
        headers = headers,
        ttl_seconds = 300,
    )
    if response.status_code != 200:
        print("Usage metrics request failed with HTTP %d" % response.status_code)
        return None
    return response.json()

def _digit_box(digit, color):
    return render.Box(
        width = 9,
        height = 14,
        color = "#252a33",
        child = render.Column(
            main_align = "center",
            cross_align = "center",
            children = [
                render.Text(digit, font = FONT_DIGIT, color = color),
            ],
        ),
    )

def _odometer_lane(label, value, color):
    digits = _million_digits(value)
    cells = []
    for index in range(len(digits)):
        if index > 0:
            cells.append(render.Box(width = 1))
        digit_color = color if index == len(digits) - 1 else "#f7f8fa"
        cells.append(_digit_box(digits[index], digit_color))

    return render.Box(
        height = 16,
        child = render.Row(
            main_align = "center",
            cross_align = "center",
            children = [
                render.Box(
                    width = 10,
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [
                            render.Text(label, font = FONT_LABEL, color = color),
                        ],
                    ),
                ),
                render.Box(width = 1),
            ] + cells,
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
                    render.Text("TOKEN USE", font = "tb-8", color = CODEX),
                    render.Text("OFFLINE", font = "5x8", color = "#ff6f83"),
                ],
            ),
        ),
    )

def main(config):
    usage = _load_usage(config)
    if usage == None:
        return _offline()

    values = usage.get("trailing_30d", {})
    codex = values.get("codex", 0)
    claude = values.get("claude", 0)

    return render.Root(
        max_age = 900,
        child = render.Box(
            color = "#080b11",
            child = render.Column(
                children = [
                    _odometer_lane("CX", codex, CODEX),
                    _odometer_lane("CL", claude, CLAUDE),
                ],
            ),
        ),
    )
