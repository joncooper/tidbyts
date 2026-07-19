load("render.star", "render")

FONT = "CG-pixel-3x5-mono"
FONT_BIG = "6x13"
BG = "#080b11"
GREEN = "#67d56f"
DARK_GREEN = "#23663b"
HAIR = "#141821"
HOODIE = "#3977d7"
HOODIE_DARK = "#1c3f7b"
VISOR_A = "#ff5e80"
VISOR_B = "#f9d65c"
VISOR_C = "#59e3d1"
WHITE = "#f7f8fa"

def _int(config, name, fallback):
    value = config.str(name)
    return int(value) if value else fallback

def _row(runs, height = 1):
    children = []
    for run in runs:
        children.append(render.Box(width = run[0], height = height, color = run[1]))
    return render.Row(children = children)

def _sprite(frame, celebrating):
    # Full-body Glint is the wide shot at each end of the zoom loop.
    if frame == 0:
        visor_1, visor_2, visor_3 = VISOR_A, VISOR_B, VISOR_C
    elif frame == 1:
        visor_1, visor_2, visor_3 = VISOR_C, VISOR_A, VISOR_B
    elif frame == 2:
        visor_1, visor_2, visor_3 = VISOR_B, VISOR_C, VISOR_A
    else:
        visor_1, visor_2, visor_3 = VISOR_C, VISOR_B, VISOR_A
    left_hand = GREEN if frame == 0 or frame == 2 else HOODIE
    right_hand = GREEN if frame == 1 or frame == 3 else HOODIE
    key_1 = VISOR_C if frame == 0 else "#687587"
    key_2 = VISOR_A if frame == 1 else "#687587"
    key_3 = VISOR_B if frame == 2 else "#687587"
    key_4 = VISOR_C if frame == 3 else "#687587"
    key_5 = "#f0f3f6" if frame == 0 or frame == 3 else "#687587"
    sparkle_left = VISOR_B if celebrating and (frame == 0 or frame == 2) else (VISOR_C if frame == 0 else BG)
    sparkle_right = VISOR_A if celebrating and (frame == 1 or frame == 3) else (VISOR_A if frame == 2 else BG)
    return render.Box(
        width = 34,
        height = 32,
        child = render.Column(
            children = [
                _row([(3, sparkle_left), (21, BG), (2, sparkle_right), (8, BG)]),
                _row([(7, BG), (3, HAIR), (2, BG), (3, HAIR), (19, BG)]),
                _row([(5, BG), (2, HAIR), (13, HAIR), (2, BG), (12, BG)]),
                _row([(3, BG), (4, DARK_GREEN), (2, HAIR), (11, HAIR), (4, DARK_GREEN), (10, BG)]),
                _row([(1, BG), (6, GREEN), (2, DARK_GREEN), (11, GREEN), (2, DARK_GREEN), (6, GREEN), (6, BG)]),
                _row([(2, BG), (6, GREEN), (2, DARK_GREEN), (9, GREEN), (2, DARK_GREEN), (6, GREEN), (7, BG)]),
                _row([(4, BG), (3, DARK_GREEN), (2, GREEN), (12, GREEN), (3, DARK_GREEN), (10, BG)]),
                _row([(7, BG), (2, GREEN), (4, visor_1), (4, visor_2), (4, visor_3), (2, GREEN), (11, BG)]),
                _row([(8, BG), (2, DARK_GREEN), (11, GREEN), (2, DARK_GREEN), (11, BG)]),
                _row([(9, BG), (2, GREEN), (3, "#15202b"), (3, GREEN), (3, "#15202b"), (2, GREEN), (12, BG)]),
                _row([(9, BG), (3, GREEN), (8, GREEN), (3, GREEN), (11, BG)]),
                _row([(10, BG), (3, GREEN), (4, "#2b3329"), (3, GREEN), (14, BG)]),
                _row([(10, BG), (12, GREEN), (12, BG)]),
                _row([(8, BG), (16, HOODIE_DARK), (10, BG)]),
                _row([(7, BG), (18, HOODIE), (9, BG)]),
                _row([(6, BG), (7, HOODIE), (6, HOODIE_DARK), (7, HOODIE), (8, BG)]),
                _row([(5, BG), (8, HOODIE), (6, HOODIE_DARK), (8, HOODIE), (7, BG)]),
                _row([(5, BG), (7, HOODIE), (2, GREEN), (4, HOODIE_DARK), (2, GREEN), (7, HOODIE), (7, BG)]),
                _row([(6, BG), (6, HOODIE), (3, left_hand), (4, HOODIE_DARK), (3, right_hand), (6, HOODIE), (6, BG)]),
                _row([(8, BG), (18, HOODIE), (8, BG)]),
                _row([(4, BG), (26, "#313b49"), (4, BG)]),
                _row([(4, BG), (2, "#313b49"), (3, key_1), (1, "#313b49"), (4, key_2), (1, "#313b49"), (4, key_3), (1, "#313b49"), (3, key_4), (1, "#313b49"), (4, key_5), (2, "#313b49"), (4, BG)]),
                _row([(4, BG), (26, "#1b222d"), (4, BG)]),
                _row([(10, BG), (5, HOODIE_DARK), (4, BG), (5, HOODIE_DARK), (10, BG)]),
                _row([(8, BG), (8, "#293443"), (2, BG), (8, "#293443"), (8, BG)]),
                _row([(6, BG), (10, "#202733"), (2, BG), (10, "#202733"), (6, BG)]),
                _row([(34, BG)], height = 6),
            ],
        ),
    )

def _face_sprite(frame, close, celebrating):
    if frame == 0 or frame == 4:
        visor_1, visor_2, visor_3 = VISOR_A, VISOR_B, VISOR_C
    elif frame == 1 or frame == 5:
        visor_1, visor_2, visor_3 = VISOR_C, VISOR_A, VISOR_B
    elif frame == 2:
        visor_1, visor_2, visor_3 = VISOR_B, VISOR_C, VISOR_A
    else:
        visor_1, visor_2, visor_3 = VISOR_C, VISOR_B, VISOR_A
    sparkle_1 = VISOR_B if celebrating or frame == 2 else BG
    sparkle_2 = VISOR_A if celebrating or frame == 3 else BG

    if close:
        rows = [
            [(3, sparkle_1), (3, BG), (22, HAIR), (3, BG), (3, sparkle_2)],
            [(4, BG), (26, HAIR), (4, BG)],
            [(2, GREEN), (4, DARK_GREEN), (22, GREEN), (4, DARK_GREEN), (2, GREEN)],
            [(4, GREEN), (2, DARK_GREEN), (22, GREEN), (2, DARK_GREEN), (4, GREEN)],
            [(6, BG), (22, GREEN), (6, BG)],
            [(6, BG), (7, visor_1), (8, visor_2), (7, visor_3), (6, BG)],
            [(6, BG), (7, visor_1), (8, visor_2), (7, visor_3), (6, BG)],
            [(6, BG), (22, GREEN), (6, BG)],
            [(6, BG), (4, GREEN), (4, "#15202b"), (6, GREEN), (4, "#15202b"), (4, GREEN), (6, BG)],
            [(6, BG), (22, GREEN), (6, BG)],
            [(6, BG), (7, GREEN), (8, "#26352b"), (7, GREEN), (6, BG)],
            [(6, BG), (22, GREEN), (6, BG)],
            [(10, BG), (14, DARK_GREEN), (10, BG)],
            [(4, BG), (26, HOODIE), (4, BG)],
            [(2, BG), (30, HOODIE), (2, BG)],
            [(2, BG), (30, HOODIE_DARK), (2, BG)],
        ]
    else:
        rows = [
            [(3, sparkle_1), (5, BG), (18, HAIR), (5, BG), (3, sparkle_2)],
            [(6, BG), (22, HAIR), (6, BG)],
            [(2, BG), (5, GREEN), (2, DARK_GREEN), (16, GREEN), (2, DARK_GREEN), (5, GREEN), (2, BG)],
            [(4, BG), (4, DARK_GREEN), (18, GREEN), (4, DARK_GREEN), (4, BG)],
            [(7, BG), (20, GREEN), (7, BG)],
            [(7, BG), (6, visor_1), (7, visor_2), (7, visor_3), (7, BG)],
            [(7, BG), (6, visor_1), (7, visor_2), (7, visor_3), (7, BG)],
            [(7, BG), (20, GREEN), (7, BG)],
            [(7, BG), (3, GREEN), (3, "#15202b"), (8, GREEN), (3, "#15202b"), (3, GREEN), (7, BG)],
            [(7, BG), (20, GREEN), (7, BG)],
            [(7, BG), (6, GREEN), (8, "#26352b"), (6, GREEN), (7, BG)],
            [(7, BG), (20, GREEN), (7, BG)],
            [(10, BG), (14, DARK_GREEN), (10, BG)],
            [(6, BG), (22, HOODIE), (6, BG)],
            [(4, BG), (26, HOODIE), (4, BG)],
            [(4, BG), (26, HOODIE_DARK), (4, BG)],
        ]

    children = []
    for runs in rows:
        children.append(_row(runs, height = 2))
    return render.Box(
        width = 34,
        height = 32,
        child = render.Column(children = children),
    )

def _activity(frame, color):
    colors = ["#263242", "#263242", "#263242", "#263242"]
    colors[frame] = color
    return render.Row(children = [
        render.Box(width = 3, height = 3, color = colors[0]),
        render.Box(width = 2),
        render.Box(width = 3, height = 3, color = colors[1]),
        render.Box(width = 2),
        render.Box(width = 3, height = 3, color = colors[2]),
        render.Box(width = 2),
        render.Box(width = 3, height = 3, color = colors[3]),
    ])

def _frame(config, frame, zoom):
    mode = config.str("mode") or "working"
    celebrating = mode == "celebrate"
    count = _int(config, "shipped", 3) if celebrating else _int(config, "working", 4)
    label = "SHIPPED" if celebrating else "WORKING"
    color = "#f9d65c" if celebrating else "#56e0d2"
    sprite = _sprite(frame % 4, celebrating) if zoom == 0 else _face_sprite(frame, zoom == 2, celebrating)
    return render.Box(
        color = BG,
        child = render.Row(
            children = [
                sprite,
                render.Box(
                    width = 30,
                    child = render.Column(
                        main_align = "center",
                        cross_align = "center",
                        children = [
                            render.Text(str(count), font = FONT_BIG, color = WHITE),
                            render.Text(label, font = FONT, color = color),
                            _activity(frame % 4, color),
                        ],
                    ),
                ),
            ],
        ),
    )

def main(config):
    return render.Root(
        delay = 500,
        max_age = 900,
        child = render.Animation(children = [
            _frame(config, 0, 0),
            _frame(config, 1, 1),
            _frame(config, 2, 2),
            _frame(config, 3, 2),
            _frame(config, 4, 1),
            _frame(config, 5, 0),
        ]),
    )
