def mark_highwater(record_count):
    highwater = 0
    try:
        with open('../dbmaint/highwater.txt', 'r') as f:
            highwater = int(f.read())
            highwater *= 2
        with open('../dbmaint/highwater.txt', 'w') as f:
            f.write(highwater)
    except Exception as e:
        print("Couldn't open file", e)
            

if __name__ == '__main__':
    mark_highwater(1)