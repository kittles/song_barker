import csv
 
# opening the csv file by specifying
# the location
# with the variable name as csv_file
with open('./jeremy_dogs.csv', mode='r') as csv_file:
 
    # creating an object of csv reader
    # with the delimiter as ,
    #csv_reader = csv.reader(csv_file, delimiter = ',')
    reader = csv.DictReader(csv_file);
    # list to store the names of columns
    list_of_column_names = []
    first_row = []
    # loop to iterate through the rows of csv
    count = 0
    for row in reader:
    #    if count == 0:
        # adding the first row
    #        list_of_column_names.append(row)
    #        count = count + 1
    #    elif count == 1:
            # if int(row['is_stock']) or int(row['hidden']):
            #     print('STOCK OR HIDDEN - skipping row', row['name'])
            # print(row[0])
            if int(row['is_stock']) or int(row['hidden']):
                print('STOCK OR HIDDEN - skipping row', row['name'])
                continue

            print(int(row['hidden']))
    #        first_row.append(row)
    #        count += 1
    #    else:
    #        break
        # breaking the loop after the
        # first iteration itself
        # break
 
# printing the result
# print("List of column names : ",
#       list_of_column_names[0])

# print("First row:", first_row)