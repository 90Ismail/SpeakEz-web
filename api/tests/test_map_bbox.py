import pytest

from app.services.notes import map_cache_key, parse_bbox


def test_parse_bbox_happy_path():
    assert parse_bbox("-93.25,44.96,-93.22,44.98") == (-93.25, 44.96, -93.22, 44.98)


@pytest.mark.parametrize(
    "raw",
    [
        "-93.25,44.96,-93.22",  # too few
        "-93.25,44.96,-93.22,44.98,0",  # too many
        "west,south,east,north",  # not numbers
        "-93.22,44.96,-93.25,44.98",  # w > e
        "-93.25,44.98,-93.22,44.96",  # s > n
        "-200,44.96,-93.22,44.98",  # out of range
    ],
)
def test_parse_bbox_rejects(raw):
    with pytest.raises(ValueError):
        parse_bbox(raw)


def test_cache_key_ignores_sub_grid_movement():
    a = map_cache_key((-93.2363, 44.97479, -93.2300, 44.9801))
    b = map_cache_key((-93.2361, 44.97421, -93.2299, 44.9803))
    assert a == b


def test_cache_key_separates_distant_views():
    a = map_cache_key((-93.2363, 44.97479, -93.2300, 44.9801))
    b = map_cache_key((-93.2600, 44.9600, -93.2400, 44.9700))
    assert a != b


def test_cache_key_has_no_negative_zero():
    assert "-0.000" not in map_cache_key((-0.0004, -0.0004, 0.0004, 0.0004))
